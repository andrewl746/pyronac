"""GET /api/compare on the fixtures. Checks B9, B10 and B11 of MASTERSPEC section 12."""
import numpy as np
import pytest

from app.analysis.stats import label_for

TARGET_FIELDS = {"year", "month", "harmonized", "complete", "days_covered"}
BASELINE_FIELDS = {"start_year", "end_year", "n_years", "median", "p25", "p75", "min", "max"}
DIFFERENCE_FIELDS = {"absolute", "percent", "rank", "of", "percentile", "label"}

# A box in the middle of the Pacific: no fires, ever.
EMPTY_BOX = {"west": -150.0, "south": 10.0, "east": -149.0, "north": 11.0}


@pytest.fixture(scope="module")
def cal(client, box):
    """/api/calendar for the fixture box, as {(year, month): month entry}."""
    response = client.get("/api/calendar", params={**box, "start_year": 2003, "end_year": 2026})
    assert response.status_code == 200
    return {(m["year"], m["month"]): m for m in response.json()["months"]}


def get(client, box, **params):
    response = client.get("/api/compare", params={**box, **params})
    assert response.status_code == 200, response.text
    return response.json()


def check_against_history(data):
    """B10: the median, percent, rank and label follow section 7, recomputed from history."""
    target = data["target"]["harmonized"]
    values = [entry["harmonized"] for entry in data["history"]]
    baseline, difference = data["baseline"], data["difference"]

    median = float(np.percentile(values, 50))
    assert baseline["n_years"] == len(values)
    assert baseline["median"] == pytest.approx(median, abs=0.051)
    assert baseline["p25"] == pytest.approx(float(np.percentile(values, 25)), abs=0.051)
    assert baseline["p75"] == pytest.approx(float(np.percentile(values, 75)), abs=0.051)
    assert baseline["min"] == min(values)
    assert baseline["max"] == max(values)

    assert difference["absolute"] == round(target - median, 1)
    if median == 0:
        assert difference["percent"] is None
    else:
        assert difference["percent"] == round((target - median) / median * 100, 1)
    assert difference["rank"] == 1 + sum(v > target for v in values)
    assert difference["of"] == len(values) + 1
    percentile = round(100 * sum(v < target for v in values) / len(values), 1)
    assert difference["percentile"] == percentile
    # A target exactly at the median is "near normal", whatever the percentile.
    assert difference["label"] == ("near normal" if target == median else label_for(percentile))


def test_fields_match_types_ts(client, box):
    data = get(client, box)
    assert set(data) == {"bbox", "target", "baseline", "difference", "history"}
    assert set(data["target"]) == TARGET_FIELDS
    assert set(data["baseline"]) == BASELINE_FIELDS
    assert set(data["difference"]) == DIFFERENCE_FIELDS
    for entry in data["history"]:
        assert set(entry) == {"year", "harmonized"}
    assert data["bbox"] == box


def test_default_target_is_the_latest_complete_month(client, box, cal):
    data = get(client, box)
    assert data["target"] == {
        "year": 2026,
        "month": 10,
        "harmonized": cal[(2026, 10)]["harmonized"],
        "complete": True,
        "days_covered": 31,
    }
    assert data["baseline"]["start_year"] == 2003
    assert data["baseline"]["end_year"] == 2026
    assert data["baseline"]["n_years"] == 23
    assert data["difference"]["of"] == 24


def test_history_is_every_other_october(client, box, cal):
    """B9: target and history equal the same months in /api/calendar."""
    data = get(client, box)
    assert [entry["year"] for entry in data["history"]] == list(range(2003, 2026))
    for entry in data["history"]:
        assert entry["harmonized"] == cal[(entry["year"], 10)]["harmonized"]


def test_median_matches_the_calendar_by_hand(client, box, cal):
    data = get(client, box)
    octobers = sorted(cal[(year, 10)]["harmonized"] for year in range(2003, 2026))
    assert len(octobers) == 23
    by_hand = octobers[11]  # the middle of 23 sorted values
    assert data["baseline"]["median"] == by_hand
    assert data["difference"]["absolute"] == round(data["target"]["harmonized"] - by_hand, 1)


@pytest.mark.parametrize("year, month", [(2026, 10), (2023, 7), (2014, 7), (2005, 1), (2012, 1), (2012, 2)])
def test_statistics_follow_the_rules(client, box, cal, year, month):
    data = get(client, box, year=year, month=month)
    assert data["target"]["harmonized"] == cal[(year, month)]["harmonized"]
    for entry in data["history"]:
        assert entry["harmonized"] == cal[(entry["year"], month)]["harmonized"]
    assert year not in [entry["year"] for entry in data["history"]]
    check_against_history(data)


def test_big_fire_year_is_well_above_normal(client, box):
    data = get(client, box, year=2023, month=7)
    assert data["difference"]["label"] == "well above normal"
    assert data["difference"]["percent"] > 100
    # Only July 2014, the other very big fire year, is above it.
    above = [entry["year"] for entry in data["history"] if entry["harmonized"] > data["target"]["harmonized"]]
    assert above == [2014]
    assert data["difference"]["rank"] == 2


def test_partial_month_is_not_scaled(client, box, cal):
    """B11: the current month returns complete false and the count as it is."""
    data = get(client, box, year=2026, month=11)
    assert data["target"]["complete"] is False
    assert data["target"]["days_covered"] == 6
    assert data["target"]["harmonized"] == cal[(2026, 11)]["harmonized"]
    # Compared with full Novembers, 2003 to 2025.
    assert [entry["year"] for entry in data["history"]] == list(range(2003, 2026))
    check_against_history(data)


def test_baseline_leaves_out_a_year_whose_month_is_not_complete(client, box):
    # November 2026 is partial, so it cannot be a baseline year for November 2020.
    data = get(client, box, year=2020, month=11)
    years = [entry["year"] for entry in data["history"]]
    assert years == [y for y in range(2003, 2026) if y != 2020]
    assert data["baseline"]["end_year"] == 2026
    assert data["baseline"]["n_years"] == 22

    # October 2026 is complete, so it is one for October 2020.
    data = get(client, box, year=2020, month=10)
    assert [entry["year"] for entry in data["history"]] == [y for y in range(2003, 2027) if y != 2020]


def test_baseline_range(client, box, cal):
    data = get(client, box, year=2023, month=7, baseline_start=2012, baseline_end=2019)
    assert [entry["year"] for entry in data["history"]] == list(range(2012, 2020))
    assert data["baseline"]["start_year"] == 2012
    assert data["baseline"]["end_year"] == 2019
    assert data["baseline"]["n_years"] == 8
    assert data["difference"]["of"] == 9
    check_against_history(data)


def test_number_types(client, box):
    data = get(client, box)
    assert isinstance(data["target"]["harmonized"], float)
    assert isinstance(data["target"]["days_covered"], int)
    assert isinstance(data["difference"]["rank"], int)
    assert isinstance(data["difference"]["of"], int)
    for entry in data["history"]:
        assert isinstance(entry["harmonized"], float)
        assert entry["harmonized"] == round(entry["harmonized"], 1)


def test_empty_area(client):
    data = get(client, EMPTY_BOX)
    assert data["target"]["harmonized"] == 0.0
    assert all(entry["harmonized"] == 0.0 for entry in data["history"])
    assert len(data["history"]) == 23
    assert data["baseline"]["median"] == 0.0
    assert data["baseline"]["max"] == 0.0
    assert data["difference"]["absolute"] == 0.0
    assert data["difference"]["percent"] is None
    assert data["difference"]["rank"] == 1
    assert data["difference"]["percentile"] == 0.0
    assert data["difference"]["label"] == "near normal"  # no fire where none is usual


def test_bbox_is_snapped_outward(client):
    data = get(client, {"west": -115.55, "south": 61.42, "east": -114.48, "north": 62.13})
    assert data["bbox"] == {"west": -115.6, "south": 61.4, "east": -114.4, "north": 62.2}


@pytest.mark.parametrize(
    "params",
    [
        {"year": 2023},  # year without month
        {"month": 7},  # month without year
        {"year": 2023, "month": 13},
        {"year": 2023, "month": 0},
        {"year": 2002, "month": 12},  # before the record starts
        {"year": 2026, "month": 12},  # after the latest data
        {"year": 2023, "month": 7, "baseline_start": 2023, "baseline_end": 2023},  # only the target year
        {"year": 2023, "month": 7, "baseline_start": 2020, "baseline_end": 2010},
        {"year": 2023, "month": 7, "baseline_start": 2030, "baseline_end": 2040},  # no data yet
    ],
)
def test_bad_values_return_400(client, box, params):
    response = client.get("/api/compare", params={**box, **params})
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)


def test_bad_box_and_missing_parameters(client, box):
    bad = {**box, "west": box["east"]}
    assert client.get("/api/compare", params=bad).status_code == 400
    missing = {k: v for k, v in box.items() if k != "north"}
    assert client.get("/api/compare", params=missing).status_code == 422
    assert client.get("/api/compare", params={**box, "year": "abc", "month": 7}).status_code == 422
    assert client.get("/api/compare", params={**box, "baseline_start": 1999}).status_code == 422
