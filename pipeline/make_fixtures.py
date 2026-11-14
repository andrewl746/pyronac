"""Write small fake FIRMS-format CSV files so everyone can work before real data exists.

Usage, from the repo root:   python pipeline/make_fixtures.py
Output:                      data/fixtures/raw/<source>/<source>_<year>_Canada.csv

The numbers are invented. Only the file shape matches the real FIRMS files.
Uses the standard library only, and always writes the same files.
"""
import calendar
import csv
import random
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "fixtures" / "raw"

# A 2 x 2 degree box near Yellowknife: longitude -116 to -114, latitude 61 to 63.
WEST, SOUTH, SIZE = -116.0, 61.0, 2.0
SEASON = [0, 0, 0.02, 0.2, 1.0, 2.5, 4.0, 3.0, 1.0, 0.2, 0.02, 0]  # January to December
BIG_YEARS = {2004: 2.0, 2014: 3.0, 2017: 1.8, 2023: 5.0}
MODIS_PER_MONTH = 12       # average MODIS detections in a peak-free month with season weight 1
VIIRS_PER_MODIS = 4.5      # VIIRS sees several times more hot spots than MODIS
LAST_DAY = date(2026, 11, 6)

MODIS_HEADER = (
    "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,"
    "instrument,confidence,version,bright_t31,frp,daynight,type"
).split(",")
VIIRS_HEADER = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,"
    "instrument,confidence,version,bright_ti5,frp,daynight,type"
).split(",")

# source folder -> (first day with data, last day with data)
SOURCES = {
    "modis": (date(2003, 1, 1), LAST_DAY),
    "viirs-snpp": (date(2012, 1, 20), date(2026, 11, 2)),
    "viirs-jpss1": (date(2018, 4, 1), LAST_DAY),
}


def month_plan(rng):
    """For every month, pick how busy it is and where the fires are. Shared by all sources."""
    plan = {}
    for year in range(2003, 2027):
        year_factor = BIG_YEARS.get(year, 1.0) * rng.uniform(0.6, 1.4)
        for month in range(1, 13):
            centres = [
                (WEST + rng.uniform(0.2, SIZE - 0.2), SOUTH + rng.uniform(0.2, SIZE - 0.2))
                for _ in range(3)
            ]
            plan[(year, month)] = (MODIS_PER_MONTH * SEASON[month - 1] * year_factor, centres)
    return plan


def draw_count(rng, mean):
    if mean <= 0:
        return 0
    return max(0, int(round(rng.gauss(mean, mean ** 0.5))))


def modis_row(rng, lat, lon, day, nrt):
    confidence = rng.choice([20, 45, 60, 75, 85, 95, 100])  # 20 is low confidence and must be dropped
    satellite = rng.choice(["Terra", "Aqua"])
    return [
        f"{lat:.4f}", f"{lon:.4f}", f"{rng.uniform(300, 360):.1f}", "1.2", "1.1",
        day.isoformat(), f"{rng.randrange(0, 24):02d}{rng.randrange(0, 60):02d}",
        satellite[0] if nrt else satellite, "MODIS", confidence,
        "6.1NRT" if nrt else "6.1", f"{rng.uniform(270, 300):.1f}", f"{rng.uniform(5, 300):.1f}",
        rng.choice(["D", "N"]), "" if nrt else rng.choice([0, 0, 0, 0, 0, 0, 0, 0, 0, 2]),
    ]


def viirs_row(rng, lat, lon, day, nrt, satellite_code):
    letter = rng.choice(["l", "n", "n", "n", "n", "h", "h"])  # l is low confidence and must be dropped
    confidence = {"l": "low", "n": "nominal", "h": "high"}[letter] if nrt else letter
    return [
        f"{lat:.5f}", f"{lon:.5f}", f"{rng.uniform(300, 367):.2f}", "0.4", "0.4",
        day.isoformat(), f"{rng.randrange(0, 24):02d}{rng.randrange(0, 60):02d}",
        satellite_code, "VIIRS", confidence,
        "2.0NRT" if nrt else "2", f"{rng.uniform(260, 300):.2f}", f"{rng.uniform(0.5, 80):.2f}",
        rng.choice(["D", "N"]), "" if nrt else rng.choice([0, 0, 0, 0, 0, 0, 0, 0, 0, 2]),
    ]


def main():
    plan_rng = random.Random(20261114)
    plan = month_plan(plan_rng)
    total = 0
    for source, (first_day, last_day) in SOURCES.items():
        rng = random.Random(f"fire-almanac-{source}")
        header = MODIS_HEADER if source == "modis" else VIIRS_HEADER
        scale = 1.0 if source == "modis" else VIIRS_PER_MODIS
        satellite_code = {"viirs-snpp": "N", "viirs-jpss1": "N20"}.get(source)
        folder = OUT / source
        folder.mkdir(parents=True, exist_ok=True)
        for year in range(first_day.year, last_day.year + 1):
            rows = []
            for month in range(1, 13):
                mean, centres = plan[(year, month)]
                days_in_month = calendar.monthrange(year, month)[1]
                for _ in range(draw_count(rng, mean * scale)):
                    day = date(year, month, rng.randrange(1, days_in_month + 1))
                    if day < first_day or day > last_day:
                        continue
                    centre_lon, centre_lat = rng.choice(centres)
                    lon = min(max(centre_lon + rng.gauss(0, 0.08), WEST + 0.001), WEST + SIZE - 0.001)
                    lat = min(max(centre_lat + rng.gauss(0, 0.08), SOUTH + 0.001), SOUTH + SIZE - 0.001)
                    nrt = day >= date(2026, 7, 1)  # recent months look like near-real-time files
                    if source == "modis":
                        rows.append(modis_row(rng, lat, lon, day, nrt))
                    else:
                        rows.append(viirs_row(rng, lat, lon, day, nrt, satellite_code))
            if year == 2026:
                # A few fixed detections on 1 to 6 November so the current month is never empty.
                for day_of_month in range(1, 7):
                    day = date(2026, 11, day_of_month)
                    if day < first_day or day > last_day:
                        continue
                    for _ in range(1 if source == "modis" else 4):
                        lon = -115.0 + rng.gauss(0, 0.05)
                        lat = 62.0 + rng.gauss(0, 0.05)
                        if source == "modis":
                            rows.append(modis_row(rng, lat, lon, day, True))
                        else:
                            rows.append(viirs_row(rng, lat, lon, day, True, satellite_code))
            rows.sort(key=lambda r: (r[5], r[6]))
            path = folder / f"{source}_{year}_Canada.csv"
            with open(path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle, lineterminator="\n")
                writer.writerow(header)
                writer.writerows(rows)
            total += len(rows)
    print(f"Wrote {total} fake detections under {OUT}")


if __name__ == "__main__":
    main()
