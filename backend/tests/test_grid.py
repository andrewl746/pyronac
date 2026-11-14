"""GET /api/grid on the fixtures."""
import pytest

# One month per era: MODIS scaled, Suomi NPP as observed, NOAA-20.
MONTHS = [(2005, 7), (2023, 7), (2026, 11)]


def calendar_month(client, box, year, month):
    body = client.get("/api/calendar", params={**box, "start_year": year, "end_year": year}).json()
    return next(m for m in body["months"] if m["month"] == month)


def grid(client, box, year, month, **extra):
    text = f"{year:04d}-{month:02d}"
    response = client.get("/api/grid", params={**box, "start": text, "end": text, **extra})
    assert response.status_code == 200
    return response.json()


def test_fields_match_types_ts(client, box):
    body = grid(client, box, 2023, 7)
    assert set(body) == {"bbox", "start", "end", "step", "cells", "max"}
    assert body["bbox"] == box
    assert body["start"] == "2023-07" and body["end"] == "2023-07"
    assert body["step"] == 1  # a 2 degree box
    assert body["cells"]
    for cell in body["cells"]:
        assert len(cell) == 3
        assert isinstance(cell[0], int) and isinstance(cell[1], int)
        assert cell[2] > 0
    assert body["max"] == max(cell[2] for cell in body["cells"])


@pytest.mark.parametrize("year,month", MONTHS)
@pytest.mark.parametrize("step", [1, 5, 10])
def test_cells_add_up_to_the_calendar(client, box, year, month, step):
    body = grid(client, box, year, month, step=step)
    expected = calendar_month(client, box, year, month)["harmonized"]
    assert expected > 0
    total = sum(cell[2] for cell in body["cells"])
    # each cell and the calendar value are rounded to 1 place
    assert total == pytest.approx(expected, abs=0.05 * (len(body["cells"]) + 1) + 1e-6)


def test_cells_are_inside_the_box(client, box):
    for step in (1, 5, 10):
        body = grid(client, box, 2023, 7, step=step)
        for x, y, _ in body["cells"]:
            assert box["west"] <= x * step / 10 and (x + 1) * step / 10 <= box["east"]
            assert box["south"] <= y * step / 10 and (y + 1) * step / 10 <= box["north"]


def test_step_10_gives_at_most_4_cells(client, box):
    body = grid(client, box, 2023, 7, step=10)
    assert 1 <= len(body["cells"]) <= 4
    assert {(x, y) for x, y, _ in body["cells"]} <= {(-116, 61), (-115, 61), (-116, 62), (-115, 62)}


def test_period_of_several_months(client, box):
    response = client.get("/api/grid", params={**box, "start": "2023-01", "end": "2023-12", "step": 10})
    year = client.get("/api/calendar", params={**box, "start_year": 2023, "end_year": 2023}).json()
    expected = sum(m["harmonized"] for m in year["months"])
    assert sum(cell[2] for cell in response.json()["cells"]) == pytest.approx(expected, abs=1.0)


def test_default_step_follows_box_width(client):
    def step_for(west, east):
        params = {"west": west, "south": 50, "east": east, "north": 60, "start": "2023-07", "end": "2023-07"}
        return client.get("/api/grid", params=params).json()["step"]

    assert step_for(-115, -100) == 1    # 15 degrees wide
    assert step_for(-115, -99.9) == 5   # just over 15
    assert step_for(-120, -60) == 5     # 60 degrees wide
    assert step_for(-180, 180) == 10    # the world view


def test_world_view(client):
    params = {"west": -180, "south": -90, "east": 180, "north": 90, "start": "2003-01", "end": "2026-12", "step": 10}
    body = client.get("/api/grid", params=params).json()
    assert {(x, y) for x, y, _ in body["cells"]} <= {(-116, 61), (-115, 61), (-116, 62), (-115, 62)}


def test_empty_area(client):
    params = {"west": 10, "south": 10, "east": 11, "north": 11, "start": "2023-07", "end": "2023-07"}
    body = client.get("/api/grid", params=params).json()
    assert body["cells"] == [] and body["max"] == 0


def test_errors(client, box):
    def status(**extra):
        response = client.get("/api/grid", params={**box, "start": "2023-07", "end": "2023-07", **extra})
        if response.status_code == 400:
            assert isinstance(response.json()["detail"], str)
        return response.status_code

    assert status(start="2023-08") == 400         # start after end
    assert status(start="2023-13") == 400         # not a month
    assert status(end="July 2023") == 400
    assert status(end="2023-7") == 400
    assert status(step=2) == 400
    assert status(step="big") == 422              # wrong type
    assert status(west=-114.0, east=-116.0) == 400
    assert client.get("/api/grid", params=box).status_code == 422  # start and end missing
