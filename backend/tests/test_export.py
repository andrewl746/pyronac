"""GET /api/points/count and /api/points.csv on the fixtures."""
import calendar
import csv
import io

import pytest

from app import config

HEADER = "latitude,longitude,acq_date,acq_time,sensor,satellite,confidence,frp,daynight"
# One month per era: MODIS only, MODIS and Suomi NPP, MODIS and NOAA-20.
MONTHS = [(2005, 7), (2023, 7), (2026, 11)]


def month_range(year, month):
    last_day = calendar.monthrange(year, month)[1]
    return {"start": f"{year:04d}-{month:02d}-01", "end": f"{year:04d}-{month:02d}-{last_day:02d}"}


def calendar_month(client, box, year, month):
    body = client.get("/api/calendar", params={**box, "start_year": year, "end_year": year}).json()
    return next(m for m in body["months"] if m["month"] == month)


def count(client, box, year, month, **extra):
    response = client.get("/api/points/count", params={**box, **month_range(year, month), **extra})
    assert response.status_code == 200
    assert set(response.json()) == {"count"}
    return response.json()["count"]


def read_csv(response):
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.splitlines()
    assert lines[0] == HEADER
    return list(csv.DictReader(io.StringIO(response.text)))


@pytest.mark.parametrize("year,month", MONTHS)
def test_counts_match_the_calendar(client, box, year, month):
    expected = calendar_month(client, box, year, month)
    modis = count(client, box, year, month, sensor="modis")
    viirs = count(client, box, year, month, sensor="viirs")
    assert modis == expected["modis"]
    assert viirs == (expected["viirs"] or 0)
    assert count(client, box, year, month, sensor="all") == modis + viirs
    assert count(client, box, year, month) == modis + viirs  # sensor defaults to all


def test_july_2023_csv_has_exactly_the_counted_rows(client, box):
    expected = calendar_month(client, box, 2023, 7)
    assert expected["viirs"] > 0 and expected["modis"] > 0
    for sensor, name, n in (("viirs", "VIIRS", expected["viirs"]), ("modis", "MODIS", expected["modis"])):
        response = client.get("/api/points.csv", params={**box, **month_range(2023, 7), "sensor": sensor})
        rows = read_csv(response)
        assert len(rows) == n
        assert len(response.text.splitlines()) == n + 1
        assert {row["sensor"] for row in rows} == {name}
    everything = read_csv(client.get("/api/points.csv", params={**box, **month_range(2023, 7)}))
    assert len(everything) == expected["viirs"] + expected["modis"]


def test_csv_content_and_order(client, box):
    response = client.get("/api/points.csv", params={**box, "start": "2023-06-15", "end": "2023-07-15"})
    assert response.headers["content-disposition"] == 'attachment; filename="hotspots_2023-06-15_2023-07-15.csv"'
    rows = read_csv(response)
    assert rows
    keys = [(r["acq_date"], r["acq_time"], float(r["latitude"]), float(r["longitude"])) for r in rows]
    assert keys == sorted(keys)
    for row in rows:
        assert "2023-06-15" <= row["acq_date"] <= "2023-07-15"
        assert len(row["acq_time"]) == 4 and row["acq_time"].isdigit()
        assert row["sensor"] in ("MODIS", "VIIRS")
        assert row["satellite"] in ("Terra", "Aqua", "SNPP")
        assert row["confidence"] in ("nominal", "high")
        assert row["daynight"] in ("D", "N")
        assert box["south"] <= float(row["latitude"]) < box["north"]
        assert box["west"] <= float(row["longitude"]) < box["east"]
        float(row["frp"])


def test_dates_spanning_years(client, box):
    params = {**box, "start": "2022-12-01", "end": "2024-01-31"}
    total = client.get("/api/points/count", params=params).json()["count"]
    year = client.get("/api/calendar", params={**box, "start_year": 2022, "end_year": 2024}).json()
    wanted = [m for m in year["months"] if 202212 <= m["year"] * 100 + m["month"] <= 202401]
    assert total == sum(m["modis"] + m["viirs"] for m in wanted)


def test_small_box_is_snapped_and_filters_by_cell(client):
    params = {"west": -115.04, "south": 61.96, "east": -114.96, "north": 62.04, "start": "2026-11-01", "end": "2026-11-30"}
    rows = read_csv(client.get("/api/points.csv", params=params))
    assert len(rows) == client.get("/api/points/count", params=params).json()["count"]
    for row in rows:
        assert 61.9 <= float(row["latitude"]) < 62.1
        assert -115.1 <= float(row["longitude"]) < -114.9


def test_empty_result_still_has_the_header(client):
    params = {"west": 10, "south": 10, "east": 11, "north": 11, "start": "2023-07-01", "end": "2023-07-31"}
    assert client.get("/api/points/count", params=params).json() == {"count": 0}
    response = client.get("/api/points.csv", params=params)
    assert response.status_code == 200
    assert response.text.splitlines() == [HEADER]


def test_too_many_rows(client, box, monkeypatch):
    params = {**box, **month_range(2023, 7)}
    n = client.get("/api/points/count", params=params).json()["count"]
    monkeypatch.setattr(config, "MAX_CSV_ROWS", n - 1)
    response = client.get("/api/points.csv", params=params)
    assert response.status_code == 400
    assert response.json() == {
        "detail": f"Too many hot spots ({n}). Choose a smaller area or a shorter date range."
    }
    monkeypatch.setattr(config, "MAX_CSV_ROWS", n)
    assert client.get("/api/points.csv", params=params).status_code == 200


@pytest.mark.parametrize("path", ["/api/points/count", "/api/points.csv"])
def test_errors(client, box, path):
    def status(**extra):
        response = client.get(path, params={**box, **month_range(2023, 7), **extra})
        if response.status_code == 400:
            assert isinstance(response.json()["detail"], str)
        return response.status_code

    assert status(start="2023-08-01") == 400       # start after end
    assert status(sensor="radar") == 400
    assert status(start="2023-02-30") == 400       # not a date
    assert status(end="2023-07") == 400
    assert status(west=-114.0, east=-116.0) == 400
    assert client.get(path, params=box).status_code == 422  # start and end missing


def test_csv_text_matches_python_csv_formatting(client, box):
    """DuckDB builds each line. It must write exactly what Python's csv module would."""
    from datetime import date

    from app import db

    params = {**box, "start": "2023-01-01", "end": "2026-11-30"}
    text = client.get("/api/points.csv", params=params).text
    rows = db.query(
        """
        SELECT latitude, longitude, acq_date, acq_time, sensor, satellite, confidence, frp, daynight
        FROM points
        WHERE acq_date BETWEEN DATE '2023-01-01' AND DATE '2026-11-30'
        ORDER BY acq_date, acq_time, latitude, longitude
        """
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(HEADER.split(","))
    for row in rows:
        writer.writerow([v.isoformat() if isinstance(v, date) else v for v in row.values()])
    assert len(rows) > 1000
    assert text == buffer.getvalue()
