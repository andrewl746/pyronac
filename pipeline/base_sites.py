"""Base planner: the best-coverage sites in Canada for small fire bases.

Usage, from the repo root:
    python pipeline/base_sites.py --towns data/raw/geonames/cities500.zip

Reads data/processed/grid.parquet and the GeoNames list of places with 500 or more people
(https://download.geonames.org/export/dump/cities500.zip, CC BY 4.0). Writes
frontend/src/components/bases/base_sites.json, which the base planner on the map reads.

The rule:
- A base reaches every 0.1 degree cell whose centre is within its reach (50 or 100 km).
- A cell counts its harmonized hot spots of June to August, and only if it is within 50 km of a
  town in the list. All towns count the same. Summer only keeps spring and autumn farm burning out.
- Each new base goes on the fire cell that reaches the most hot spots no earlier base reaches,
  so the first N sites are the answer for N bases.
- The list stops when the next base would add less than 0.3% of the fire near towns. Past that
  point the sites add next to nothing and drift to big southern cities.
- No city of 100,000 or more people gets more than 3 bases within reach.

The self-test: choose the sites from 2003 to 2015 only, then see how much of the fire near towns of
2016 to 2025 was within reach, next to the same number of random fire sites near towns.

These are candidate sites to study, not a forecast. The record knows where fire was. It does not
know roads, water or land cover.
"""
import argparse
import io
import json
import math
import zipfile
from datetime import date
from pathlib import Path

import duckdb
import numpy as np

import config

COUNTRY = "canada"
GEONAMES_COUNTRY = "CA"
REACHES_KM = [50, 100]
MAX_BASES = 100
MIN_ADD = 0.003            # a base must add at least this share of the fire near towns
CITY_MIN_PEOPLE = 100_000  # a big city, for the limit below
BASES_PER_CITY = 3         # at most this many bases may have the same big city within reach
TOWN_KM = 50               # a cell is "near a town" within this distance
TOWN_MIN_PEOPLE = 500      # what the GeoNames cities500 list holds
MONTHS = [6, 8]            # June to August
YEARS = [2003, 2025]       # full years only
TRAIN_YEARS = [2003, 2015]
TEST_YEARS = [2016, 2025]
EARLY_YEARS = [2003, 2011]  # all MODIS era, where raw and harmonized differ
CHANCE_DRAWS = 200
KM_PER_CELL = 11.12        # 0.1 degree of latitude
DEFAULT_OUT = config.ROOT / "frontend" / "src" / "components" / "bases" / "base_sites.json"


class Frame:
    """The 0.1 degree cells as an array with a margin: row 0 is cell_y = y0, column 0 is cell_x = x0.

    The margin is wide enough that a base on any real cell reaches only cells inside the array.
    """

    def __init__(self, min_x, max_x, min_y, max_y, max_reach_km):
        top_lat = (max_y + 0.5) / 10
        self.pad_y = int(max_reach_km // KM_PER_CELL) + 1
        self.pad_x = int(max_reach_km // (KM_PER_CELL * math.cos(math.radians(top_lat)))) + 1
        self.x0, self.y0 = min_x - self.pad_x, min_y - self.pad_y
        self.nx, self.ny = max_x - min_x + 1 + 2 * self.pad_x, max_y - min_y + 1 + 2 * self.pad_y

    def lat(self, row):
        return (self.y0 + row + 0.5) / 10

    def lon(self, col):
        return (self.x0 + col + 0.5) / 10

    def rows(self):
        """The rows that hold real cells, so a base can stand on them."""
        return range(self.pad_y, self.ny - self.pad_y)


def offsets(frame, reach_km):
    """For each row a base can stand on: the rows it reaches and how many cells to each side.

    A degree of longitude shrinks with latitude, so the same reach is more cells wide further north.
    """
    rows_up = int(reach_km // KM_PER_CELL)
    out = {}
    for row in frame.rows():
        km_per_col = KM_PER_CELL * math.cos(math.radians(frame.lat(row)))
        out[row] = [(dy, int(math.sqrt(reach_km ** 2 - (dy * KM_PER_CELL) ** 2) // km_per_col))
                    for dy in range(-rows_up, rows_up + 1)]
        assert max(half for _, half in out[row]) <= frame.pad_x
    return out


def window_sums(values, offs, frame):
    """For every cell a base can stand on: the total of `values` within its reach."""
    run = np.zeros((frame.ny, frame.nx + 1))
    run[:, 1:] = np.cumsum(values, axis=1)
    lo, hi = frame.pad_x, frame.nx - frame.pad_x
    out = np.zeros((frame.ny, frame.nx))
    for row, reach in offs.items():
        for dy, half in reach:
            out[row, lo:hi] += run[row + dy, lo + half + 1:hi + half + 1] - run[row + dy, lo - half:hi - half]
    return out


def reach_mask(sites, offs, frame):
    """True for every cell within reach of at least one of the sites, given as (row, col)."""
    mask = np.zeros((frame.ny, frame.nx), dtype=bool)
    for row, col in sites:
        for dy, half in offs[row]:
            mask[row + dy, col - half:col + half + 1] = True
    return mask


def greedy(weights, offs, frame, count, allowed, min_added=1e-6, after_pick=None):
    """Up to `count` sites as (row, col, added). Each goes on the allowed cell that reaches the most
    weight no earlier site reaches. `added` is that weight. Stops early when the best cell left
    would add less than `min_added`. `after_pick(row, col)` may return cells that no later site
    may stand on.
    """
    left, allowed = weights.copy(), allowed.copy()
    picks = []
    for _ in range(count):
        if not allowed.any():
            break
        gain = window_sums(left, offs, frame)
        gain[~allowed] = -1.0
        row, col = (int(i) for i in np.unravel_index(np.argmax(gain), gain.shape))
        # Added up again from the cells themselves: the running totals above carry rounding noise.
        added = float(sum(left[row + dy, col - half:col + half + 1].sum() for dy, half in offs[row]))
        if added < min_added:
            break
        picks.append((row, col, added))
        for dy, half in offs[row]:
            left[row + dy, col - half:col + half + 1] = 0.0
        blocked = after_pick(row, col) if after_pick else None
        if blocked is not None:
            allowed &= ~blocked
    return picks


class CityLimit:
    """Keeps bases from piling up around a big city. Once a city has BASES_PER_CITY bases within
    reach, no later base may stand where it would reach that city too.
    """

    def __init__(self, frame, towns, reach_km):
        t_lat, t_lon, t_people, _ = towns
        big = t_people >= CITY_MIN_PEOPLE
        self.frame, self.reach_km = frame, reach_km
        self.lat, self.lon = t_lat[big], t_lon[big]
        self.bases = np.zeros(int(big.sum()), dtype=int)
        self.cell_lat = (frame.y0 + np.arange(frame.ny) + 0.5)[:, None] / 10
        self.cell_lon = (frame.x0 + np.arange(frame.nx) + 0.5)[None, :] / 10

    def after_pick(self, row, col):
        """Count the new base against every big city it reaches. Returns the cells that are now
        off-limits because a city just reached its limit, or None.
        """
        reached = km_between(self.frame.lat(row), self.frame.lon(col), self.lat, self.lon) <= self.reach_km
        self.bases[reached] += 1
        full = reached & (self.bases == BASES_PER_CITY)
        if not full.any():
            return None
        blocked = np.zeros((self.frame.ny, self.frame.nx), dtype=bool)
        km_per_col = 10 * KM_PER_CELL * np.cos(np.radians(self.cell_lat))
        for lat, lon in zip(self.lat[full], self.lon[full]):
            blocked |= np.hypot((self.cell_lat - lat) * 10 * KM_PER_CELL, (self.cell_lon - lon) * km_per_col) <= self.reach_km
        return blocked


def coverage_curve(sites, offs, frame, target):
    """The share of `target` within reach of the first 1, 2, ... sites, given as (row, col)."""
    seen = np.zeros(target.shape, dtype=bool)
    total, reached, out = float(target.sum()), 0.0, []
    for row, col in sites:
        for dy, half in offs[row]:
            cells = (row + dy, slice(col - half, col + half + 1))
            reached += float(target[cells][~seen[cells]].sum())
            seen[cells] = True
        out.append(reached / total if total else 0.0)
    return out


def stretch(curve, length):
    """A curve cut or padded to `length`. Padding repeats the last value: no more sites, no more reach."""
    curve = list(curve[:length])
    return curve + [curve[-1] if curve else 0.0] * (length - len(curve))


def load_towns(zip_path, country=GEONAMES_COUNTRY):
    """The country's places from the GeoNames list, as (latitudes, longitudes, people, names).

    GeoNames columns are tab separated: 1 name, 4 latitude, 5 longitude, 7 feature code, 8 country
    code, 14 population. Feature code PPLX is a section of a city, whose people are already counted
    in the city, so those rows are left out.
    """
    lat, lon, people, names = [], [], [], []
    with zipfile.ZipFile(zip_path) as archive, archive.open("cities500.txt") as raw:
        for line in io.TextIOWrapper(raw, encoding="utf-8"):
            c = line.rstrip("\n").split("\t")
            if c[8] == country and c[7] != "PPLX" and int(c[14] or 0) >= TOWN_MIN_PEOPLE:
                lat.append(float(c[4]))
                lon.append(float(c[5]))
                people.append(int(c[14]))
                names.append(c[1])
    return np.array(lat), np.array(lon), np.array(people, dtype=float), names


def km_between(lat, lon, lats, lons):
    """Distance in km from one point to many, flat-earth, good enough at these ranges."""
    return np.hypot((lats - lat) * 10 * KM_PER_CELL, (lons - lon) * 10 * KM_PER_CELL * math.cos(math.radians(lat)))


def load_records(grid_path):
    """June to August rows of the country's cells, in a fixed order so every total adds up the same
    way on every run. `raw` is what the sensor of the day reported: MODIS, then VIIRS.
    """
    con = duckdb.connect()
    d = con.execute(f"""
        SELECT cell_x, cell_y, year, coalesce(harmonized_count, 0) AS h,
               coalesce(CASE WHEN year * 100 + month <= {config.MODIS_ERA_END_YM}
                             THEN modis_count ELSE snpp_count END, 0) AS raw
        FROM read_parquet(?)
        WHERE country = ? AND year BETWEEN ? AND ? AND month BETWEEN ? AND ?
        ORDER BY cell_x, cell_y, year, month""",
                    [Path(grid_path).as_posix(), COUNTRY, *YEARS, *MONTHS]).fetchnumpy()
    con.close()
    return {"cell_x": d["cell_x"], "cell_y": d["cell_y"], "year": d["year"],
            "h": d["h"].astype(float), "raw": d["raw"].astype(float)}


def layer(frame, rec, values, first_year, last_year):
    """`values` of the rows in those years, added up per cell."""
    out = np.zeros((frame.ny, frame.nx))
    keep = (rec["year"] >= first_year) & (rec["year"] <= last_year)
    np.add.at(out, (rec["row"][keep], rec["col"][keep]), values[keep])
    return out


def prepare(rec, towns):
    """The frame, with each row's cell placed in it and marked as near a town or not."""
    t_lat, t_lon, t_people, _ = towns
    frame = Frame(int(rec["cell_x"].min()), int(rec["cell_x"].max()),
                  int(rec["cell_y"].min()), int(rec["cell_y"].max()), max(REACHES_KM))
    rec["row"], rec["col"] = rec["cell_y"] - frame.y0, rec["cell_x"] - frame.x0
    people = np.zeros((frame.ny, frame.nx))
    t_row = np.floor(t_lat * 10).astype(int) - frame.y0
    t_col = np.floor(t_lon * 10).astype(int) - frame.x0
    inside = (t_row >= 0) & (t_row < frame.ny) & (t_col >= 0) & (t_col < frame.nx)
    np.add.at(people, (t_row[inside], t_col[inside]), t_people[inside])
    near = window_sums(people, offsets(frame, TOWN_KM), frame) > 0
    rec["near"] = near[rec["row"], rec["col"]]
    return frame


def build_reach(frame, rec, towns, reach_km, rng):
    """Everything the planner shows for one reach: the sites in pick order and the four curves."""
    t_lat, t_lon, t_people, t_names = towns
    offs = offsets(frame, reach_km)
    fire_near = rec["h"] * rec["near"]
    full = layer(frame, rec, fire_near, *YEARS)
    train = layer(frame, rec, fire_near, *TRAIN_YEARS)
    test = layer(frame, rec, fire_near, *TEST_YEARS)

    picks = greedy(full, offs, frame, MAX_BASES, layer(frame, rec, rec["h"], *YEARS) > 0,
                   MIN_ADD * float(full.sum()), CityLimit(frame, towns, reach_km).after_pick)
    count = len(picks)
    covered = np.cumsum([added for _, _, added in picks]) / full.sum()

    # The self-test follows the same rules and sees nothing after the training years, not even
    # which cells later burned.
    early_picks = greedy(train, offs, frame, count, layer(frame, rec, rec["h"], *TRAIN_YEARS) > 0,
                         MIN_ADD * float(train.sum()), CityLimit(frame, towns, reach_km).after_pick)
    selftest = stretch(coverage_curve([p[:2] for p in early_picks], offs, frame, test), count)
    cells = np.argwhere(train > 0)
    draws = [stretch(coverage_curve([tuple(c) for c in cells[rng.choice(len(cells), min(count, len(cells)), replace=False)]],
                                    offs, frame, test), count) for _ in range(CHANCE_DRAWS)]
    chance = np.mean(draws, axis=0)

    n_years = YEARS[1] - YEARS[0] + 1
    early = slice(EARLY_YEARS[0] - YEARS[0], EARLY_YEARS[1] - YEARS[0] + 1)
    sites, people_so_far, towns_seen = [], [], np.zeros(len(t_people), dtype=bool)
    for rank, (row, col, added) in enumerate(picks, 1):
        lat, lon = frame.lat(row), frame.lon(col)
        km = km_between(lat, lon, t_lat, t_lon)
        inside = km <= reach_km
        towns_seen |= inside
        people_so_far.append(int(t_people[towns_seen].sum()))
        biggest = int(np.flatnonzero(inside)[np.argmax(t_people[inside])]) if inside.any() else None
        own = reach_mask([(row, col)], offs, frame)[rec["row"], rec["col"]] & rec["near"]
        years = rec["year"][own] - YEARS[0]
        by_year = np.bincount(years, weights=rec["h"][own], minlength=n_years)
        raw_by_year = np.bincount(years, weights=rec["raw"][own], minlength=n_years)
        sites.append({
            "rank": rank, "lat": round(lat, 2), "lon": round(lon, 2),
            "town": t_names[biggest] if biggest is not None else None,
            "town_people": int(t_people[biggest]) if biggest is not None else 0,
            "town_km": int(round(km[biggest])) if biggest is not None else 0,
            "people": int(t_people[inside].sum()),
            "adds": round(added / float(full.sum()), 4),
            "typical_year": int(round(float(np.median(by_year)))),
            "busiest_year": YEARS[0] + int(np.argmax(by_year)),
            "busiest_count": int(round(float(by_year.max()))),
            "early_raw": int(round(float(raw_by_year[early].mean()))),
            "early_harmonized": int(round(float(by_year[early].mean()))),
        })
    return {
        "reach_km": reach_km,
        "covered": [round(float(v), 4) for v in covered],
        "selftest": [round(float(v), 4) for v in selftest],
        "chance": [round(float(v), 4) for v in chance],
        "people": people_so_far,
        "sites": sites,
    }


def plan(grid_path, towns_zip):
    rec = load_records(grid_path)
    towns = load_towns(towns_zip)
    frame = prepare(rec, towns)
    rng = np.random.default_rng(0)  # fixed, so the chance curve is the same on every run
    return {
        "generated": date.today().isoformat(),
        "country": COUNTRY,
        "years": YEARS,
        "months": MONTHS,
        "town_km": TOWN_KM,
        "town_min_people": TOWN_MIN_PEOPLE,
        "min_add": MIN_ADD,
        "city_min_people": CITY_MIN_PEOPLE,
        "bases_per_city": BASES_PER_CITY,
        "train_years": TRAIN_YEARS,
        "test_years": TEST_YEARS,
        "near_town_share": round(float((rec["h"] * rec["near"]).sum() / rec["h"].sum()), 4),
        "sources": {
            "fire": "NASA FIRMS hot spots from MODIS and VIIRS, harmonized by Pyronac (grid.parquet)",
            "towns": "GeoNames cities500, places with 500 or more people, CC BY 4.0, https://www.geonames.org",
        },
        "reaches": [build_reach(frame, rec, towns, reach_km, rng) for reach_km in REACHES_KM],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--towns", required=True, help="path to GeoNames cities500.zip")
    parser.add_argument("--grid", default=str(config.PROCESSED_DIR / "grid.parquet"), help="path to grid.parquet")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="where to write base_sites.json")
    args = parser.parse_args()

    doc = plan(args.grid, args.towns)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{doc['near_town_share']:.0%} of the summer hot spots are within {TOWN_KM} km of a town.")
    print("| Reach | Bases | Within reach, full record | Self-test | Chance | People within reach |")
    print("|---|--:|--:|--:|--:|--:|")
    for reach in doc["reaches"]:
        for n in sorted({min(n, len(reach["sites"])) for n in (10, 25, 50, 100)}):
            i = n - 1
            print(f"| {reach['reach_km']} km | {i + 1} | {reach['covered'][i]:.0%} | {reach['selftest'][i]:.0%} | "
                  f"{reach['chance'][i]:.0%} | {reach['people'][i]:,d} |")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
