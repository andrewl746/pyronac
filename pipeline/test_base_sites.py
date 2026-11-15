"""Checks for the base planner's site calculation, on small made-up grids."""
import math
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import numpy as np

import base_sites


def frame_at_60_north(reach_km=60):
    # Cells from 59 to 61 degrees north, 4 degrees of longitude wide.
    return base_sites.Frame(-1200, -1161, 590, 609, reach_km)


def records(frame, cells):
    """Rows as load_records gives them, from (cell_x, cell_y, year, h, raw) tuples."""
    x, y, year, h, raw = (np.array(v) for v in zip(*cells))
    return {"cell_x": x, "cell_y": y, "year": year, "h": h.astype(float), "raw": raw.astype(float)}


class ReachTests(unittest.TestCase):
    def setUp(self):
        self.frame = frame_at_60_north()
        self.offs = base_sites.offsets(self.frame, 60)

    def test_reach_is_every_cell_whose_centre_is_within_the_distance(self):
        row, col = self.frame.pad_y + 10, self.frame.pad_x + 20
        mask = base_sites.reach_mask([(row, col)], self.offs, self.frame)
        km_per_col = base_sites.KM_PER_CELL * math.cos(math.radians(self.frame.lat(row)))
        for r in range(self.frame.ny):
            for c in range(self.frame.nx):
                km = math.hypot((r - row) * base_sites.KM_PER_CELL, (c - col) * km_per_col)
                self.assertEqual(bool(mask[r, c]), km <= 60, (r - row, c - col, km))

    def test_same_reach_is_more_cells_wide_further_north(self):
        south, north = self.frame.pad_y, self.frame.ny - self.frame.pad_y - 1

        def width(row):
            return max(half for _, half in self.offs[row])

        self.assertGreater(width(north), width(south))
        self.assertEqual(width(south), int(60 // (base_sites.KM_PER_CELL * math.cos(math.radians(59.05)))))

    def test_window_sums_agree_with_adding_up_the_cells_in_reach(self):
        values = np.zeros((self.frame.ny, self.frame.nx))
        rng = np.random.default_rng(1)
        rows, cols = list(self.frame.rows()), range(self.frame.pad_x, self.frame.nx - self.frame.pad_x)
        values[np.ix_(rows, cols)] = rng.integers(0, 50, (len(rows), len(cols)))
        sums = base_sites.window_sums(values, self.offs, self.frame)
        for row, col in ((rows[0], cols[0]), (rows[7], cols[13]), (rows[-1], cols[-1])):
            mask = base_sites.reach_mask([(row, col)], self.offs, self.frame)
            self.assertAlmostEqual(sums[row, col], values[mask].sum(), places=6)


class GreedyTests(unittest.TestCase):
    def setUp(self):
        self.frame = frame_at_60_north()
        self.offs = base_sites.offsets(self.frame, 60)
        self.weights = np.zeros((self.frame.ny, self.frame.nx))
        self.small = (self.frame.pad_y + 3, self.frame.pad_x + 2)
        self.big = (self.frame.pad_y + 15, self.frame.pad_x + 36)   # far outside the small one's reach
        self.weights[self.small] = 10
        self.weights[self.big] = 30
        self.weights[self.big[0], self.big[1] + 1] = 5
        self.allowed = self.weights > 0

    def test_biggest_cluster_first_nothing_counted_twice_and_it_stops_when_all_is_reached(self):
        picks = base_sites.greedy(self.weights, self.offs, self.frame, 5, self.allowed)
        self.assertEqual(len(picks), 2)
        self.assertEqual(picks[0], (*self.big, 35.0))
        self.assertEqual(picks[1], (*self.small, 10.0))
        self.assertEqual(sum(added for _, _, added in picks), self.weights.sum())

    def test_a_base_only_stands_on_an_allowed_cell(self):
        allowed = np.zeros_like(self.allowed)
        allowed[self.big[0], self.big[1] + 1] = True
        picks = base_sites.greedy(self.weights, self.offs, self.frame, 5, allowed)
        self.assertEqual([p[:2] for p in picks], [(self.big[0], self.big[1] + 1)])
        self.assertEqual(base_sites.greedy(self.weights, self.offs, self.frame, 5, np.zeros_like(allowed)), [])

    def test_coverage_curve_adds_each_site_once(self):
        sites = [self.big, self.big, self.small]
        curve = base_sites.coverage_curve(sites, self.offs, self.frame, self.weights)
        self.assertEqual([round(v, 6) for v in curve], [round(35 / 45, 6), round(35 / 45, 6), 1.0])
        self.assertEqual(base_sites.stretch(curve, 5)[-2:], [1.0, 1.0])
        self.assertEqual(base_sites.stretch(curve, 1), curve[:1])


class LimitTests(unittest.TestCase):
    """A big city in the middle with fire to its north, south and east, and a small fire far to the west."""

    def setUp(self):
        self.frame = frame_at_60_north()
        self.offs = base_sites.offsets(self.frame, 60)
        self.towns = (np.array([59.95]), np.array([-118.05]), np.array([200000.0]), ["Bigcity"])
        self.weights = np.zeros((self.frame.ny, self.frame.nx))

        def cell(cell_x, cell_y):
            return cell_y - self.frame.y0, cell_x - self.frame.x0

        self.north, self.south = cell(-1181, 604), cell(-1181, 594)   # each about 56 km from the city
        self.east, self.west = cell(-1171, 599), cell(-1200, 599)     # 56 km and 106 km from the city
        for where, value in ((self.north, 30), (self.south, 20), (self.east, 10), (self.west, 5)):
            self.weights[where] = value
        self.allowed = self.weights > 0

    def sites(self, **more):
        return [p[:2] for p in base_sites.greedy(self.weights, self.offs, self.frame, 10, self.allowed, **more)]

    def test_without_a_limit_every_fire_gets_a_base(self):
        self.assertEqual(self.sites(), [self.north, self.south, self.east, self.west])

    def test_a_city_at_its_limit_gets_no_more_bases_but_places_beyond_it_still_do(self):
        with patch.object(base_sites, "BASES_PER_CITY", 2):
            limit = base_sites.CityLimit(self.frame, self.towns, 60)
            self.assertEqual(self.sites(after_pick=limit.after_pick), [self.north, self.south, self.west])
            self.assertEqual(list(limit.bases), [2])

    def test_a_small_town_sets_no_limit(self):
        towns = (self.towns[0], self.towns[1], np.array([5000.0]), ["Smalltown"])
        with patch.object(base_sites, "BASES_PER_CITY", 2):
            limit = base_sites.CityLimit(self.frame, towns, 60)
            self.assertEqual(len(self.sites(after_pick=limit.after_pick)), 4)

    def test_the_list_stops_when_the_next_base_would_add_too_little(self):
        self.assertEqual(self.sites(min_added=15), [self.north, self.south])


class TownTests(unittest.TestCase):
    def test_keeps_the_country_drops_city_sections_and_places_under_500(self):
        def line(name, lat, lon, code, country, people):
            cols = [""] * 19
            cols[1], cols[4], cols[5], cols[7], cols[8], cols[14] = name, str(lat), str(lon), code, country, str(people)
            return "\t".join(cols) + "\n"

        text = (line("Montréal", 45.5, -73.6, "PPLA2", "CA", 1762949) + line("Plateau", 45.52, -73.58, "PPLX", "CA", 100000)
                + line("Seattle", 47.6, -122.3, "PPL", "US", 700000) + line("Hamlet", 60.0, -118.0, "PPL", "CA", 120)
                + line("High Level", 58.5, -117.1, "PPL", "CA", 3159))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "cities500.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("cities500.txt", text.encode("utf-8"))
            lat, lon, people, names = base_sites.load_towns(path)
        self.assertEqual(names, ["Montréal", "High Level"])
        self.assertEqual(list(people), [1762949.0, 3159.0])
        self.assertEqual((lat[1], lon[1]), (58.5, -117.1))


class PlanTests(unittest.TestCase):
    def test_one_reach_end_to_end_on_a_small_grid(self):
        towns = (np.array([59.55]), np.array([-119.45]), np.array([2000.0]), ["Testville"])
        # Fire beside the town in both periods, and a bigger fire far from any town that must not count.
        # The last two rows only stretch the grid to its corners.
        rec = records(None, [(-1195, 595, 2005, 40, 8), (-1195, 595, 2020, 60, 60), (-1194, 596, 2010, 10, 2),
                             (-1165, 607, 2021, 500, 500), (-1200, 590, 2004, 0, 0), (-1161, 609, 2004, 0, 0)])
        frame = base_sites.prepare(rec, towns)
        self.assertEqual(list(rec["near"]), [True, True, True, False, False, False])
        out = base_sites.build_reach(frame, rec, towns, 50, np.random.default_rng(0))
        self.assertEqual(len(out["sites"]), 1)
        site = out["sites"][0]
        self.assertEqual((site["lat"], site["lon"]), (59.55, -119.45))
        self.assertEqual((site["town"], site["town_people"], site["people"]), ("Testville", 2000, 2000))
        self.assertEqual(out["covered"], [1.0])
        self.assertEqual(out["selftest"], [1.0])
        self.assertEqual(out["people"], [2000])
        self.assertEqual((site["busiest_year"], site["busiest_count"]), (2020, 60))
        # 2003 to 2011 holds 40 and 10 harmonized, 8 and 2 raw, over nine years.
        self.assertEqual((site["early_harmonized"], site["early_raw"]), (round(50 / 9), round(10 / 9)))
        for key in ("covered", "selftest", "chance", "people"):
            self.assertEqual(len(out[key]), len(out["sites"]))


if __name__ == "__main__":
    unittest.main()
