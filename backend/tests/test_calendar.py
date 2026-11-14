"""GET /api/calendar and /api/calendar.csv on the fixtures."""
import csv
import io

import pytest

MONTH_FIELDS = {"year", "month", "harmonized", "raw", "modis", "viirs", "era", "complete"}


@pytest.fixture(scope="module")
def cal(client, box):
    response = client.get("/api/calendar", params={**box, "start_year": 2003, "end_year": 2026})
    assert response.status_code == 200
    return response.json()


def ym(m):
    return m["year"] * 100 + m["month"]


def test_fields_match_types_ts(cal):
    assert set(cal) == {"bbox", "start_year", "end_year", "months", "max_harmonized", "max_raw"}
    for m in cal["months"]:
        assert set(m) == MONTH_FIELDS


def test_dense_and_ordered(cal):
    months = cal["months"]
    assert len(months) == 287
    expected = [(y, m) for y in range(2003, 2027) for m in range(1, 13) if (y, m) <= (2026, 11)]
    assert [(m["year"], m["month"]) for m in months] == expected


def test_modis_era(cal):
    era = [m for m in cal["months"] if ym(m) <= 201201]
    assert len(era) == 109
    for m in era:
        assert m["era"] == "modis"
        assert m["viirs"] is None
        assert m["raw"] == m["modis"]


def test_snpp_era(cal):
    era = [m for m in cal["months"] if 201202 <= ym(m) <= 202610]
    assert len(era) == 177
    for m in era:
        assert m["era"] == "snpp"
        assert m["harmonized"] == m["viirs"]
        assert m["raw"] == m["viirs"]


def test_last_month_is_partial_noaa20(cal):
    *earlier, last = cal["months"]
    assert (last["year"], last["month"]) == (2026, 11)
    assert last["era"] == "noaa20"
    assert last["complete"] is False
    assert last["viirs"] is not None and last["viirs"] > 0
    assert all(m["complete"] for m in earlier)


def test_big_fire_year_stands_out(cal):
    by_month = {(m["year"], m["month"]): m for m in cal["months"]}
    assert by_month[(2023, 7)]["harmonized"] > 2 * by_month[(2022, 7)]["harmonized"]


def test_number_types_and_maxima(cal):
    for m in cal["months"]:
        assert isinstance(m["raw"], int) and isinstance(m["modis"], int)
        assert m["harmonized"] == round(m["harmonized"], 1)
        assert m["harmonized"] >= 0
    assert cal["max_harmonized"] == max(m["harmonized"] for m in cal["months"])
    assert cal["max_raw"] == max(m["raw"] for m in cal["months"])


def test_defaults(client, box, cal):
    body = client.get("/api/calendar", params=box).json()
    assert body["start_year"] == 2003
    assert body["end_year"] == 2026
    assert body == cal


def test_year_range_and_empty_box(client, box):
    body = client.get("/api/calendar", params={**box, "start_year": 2010, "end_year": 2011}).json()
    assert len(body["months"]) == 24
    empty = client.get(
        "/api/calendar", params={"west": 10, "south": 10, "east": 11, "north": 11, "start_year": 2012, "end_year": 2012}
    ).json()
    assert len(empty["months"]) == 12
    assert empty["max_harmonized"] == 0 and empty["max_raw"] == 0
    assert empty["months"][0]["viirs"] is None  # January 2012 is still the modis era
    assert empty["months"][1]["viirs"] == 0


def test_bbox_is_snapped_outward(client):
    params = {"west": -114.35, "south": 62.41, "east": -114.31, "north": 62.44}
    body = client.get("/api/calendar", params=params).json()
    assert body["bbox"] == {"west": -114.4, "south": 62.4, "east": -114.3, "north": 62.5}


def test_errors(client, box):
    bad_years = client.get("/api/calendar", params={**box, "start_year": 2020, "end_year": 2010})
    assert bad_years.status_code == 400
    assert isinstance(bad_years.json()["detail"], str)
    bad_box = client.get("/api/calendar", params={**box, "west": -114.0, "east": -116.0})
    assert bad_box.status_code == 400
    assert isinstance(bad_box.json()["detail"], str)
    missing = client.get("/api/calendar", params={"west": -116.0, "south": 61.0, "east": -114.0})
    assert missing.status_code == 422
    assert client.get("/api/calendar", params={**box, "start_year": 1999}).status_code == 422


def test_csv_matches_json(client, box, cal):
    response = client.get("/api/calendar.csv", params={**box, "start_year": 2003, "end_year": 2026})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == 'attachment; filename="fire_calendar_2003_2026.csv"'
    lines = response.text.splitlines()
    assert lines[0] == "year,month,harmonized,raw,modis,viirs,era,complete"
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert len(rows) == 287
    for row, m in zip(rows, cal["months"]):
        assert int(row["year"]) == m["year"] and int(row["month"]) == m["month"]
        assert float(row["harmonized"]) == m["harmonized"]
        assert int(row["raw"]) == m["raw"] and int(row["modis"]) == m["modis"]
        assert row["viirs"] == ("" if m["viirs"] is None else str(m["viirs"]))
        assert row["era"] == m["era"]
        assert row["complete"] == ("true" if m["complete"] else "false")
