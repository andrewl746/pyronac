"""GET /api/anomaly on the fixtures."""
import numpy as np
import pytest

# A box in the middle of the Pacific: no fires, ever.
EMPTY_BOX = {"west": -150.0, "south": 10.0, "east": -149.0, "north": 11.0}


def get(client, box, **params):
    response = client.get("/api/anomaly", params={**box, **params})
    assert response.status_code == 200, response.text
    return response.json()


def month_total(client, box, year, month):
    response = client.get("/api/calendar", params={**box, "start_year": year, "end_year": year})
    return next(m["harmonized"] for m in response.json()["months"] if m["month"] == month)


def grid_cells(client, box, year, month, step):
    """/api/grid for one month, as {(x, y): harmonized}."""
    when = f"{year:04d}-{month:02d}"
    response = client.get("/api/grid", params={**box, "start": when, "end": when, "step": step})
    assert response.status_code == 200
    return {(x, y): value for x, y, value in response.json()["cells"]}


def test_fields_match_types_ts(client, box):
    data = get(client, box, year=2023, month=7)
    assert set(data) == {"bbox", "year", "month", "step", "cells"}
    assert data["bbox"] == box
    assert (data["year"], data["month"], data["step"]) == (2023, 7, 1)
    assert len(data["cells"]) > 0
    for cell in data["cells"]:
        assert len(cell) == 5
        x, y, harmonized, median, percentile = cell
        assert isinstance(x, int) and isinstance(y, int)
        assert harmonized >= 0 and median >= 0
        assert harmonized > 0 or median > 0
        assert 0 <= percentile <= 100


@pytest.mark.parametrize("year, month", [(2023, 7), (2005, 6), (2026, 10)])
@pytest.mark.parametrize("step", [1, 5, 10])
def test_values_match_the_grid_and_the_calendar(client, box, year, month, step):
    data = get(client, box, year=year, month=month, step=step)
    values = {(x, y): harmonized for x, y, harmonized, _, _ in data["cells"] if harmonized > 0}
    assert values == grid_cells(client, box, year, month, step)
    # Each cell is rounded to 1 place, so allow 0.05 a cell.
    assert sum(values.values()) == pytest.approx(month_total(client, box, year, month), abs=0.05 * len(values) + 0.05)


@pytest.mark.parametrize("year, month, step", [(2023, 7, 1), (2023, 7, 5), (2010, 8, 10), (2026, 11, 5)])
def test_median_and_percentile_recomputed_from_the_grid(client, box, year, month, step):
    """Every cell, by hand: the same calendar month in every other complete year from 2003."""
    data = get(client, box, year=year, month=month, step=step)
    # November 2026 is partial, so it is never a baseline year.
    last_baseline_year = 2026 if month <= 10 else 2025
    baseline_years = [y for y in range(2003, last_baseline_year + 1) if y != year]
    per_year = {y: grid_cells(client, box, y, month, step) for y in baseline_years}

    seen = set()
    for x, y, harmonized, median, percentile in data["cells"]:
        history = [per_year[b].get((x, y), 0.0) for b in baseline_years]
        assert median == pytest.approx(float(np.median(history)), abs=0.051)
        assert percentile == round(100 * sum(v < harmonized for v in history) / len(history), 1)
        seen.add((x, y))

    # A cell left out has no fire that month and a median of zero.
    target = grid_cells(client, box, year, month, step)
    everywhere = set(target).union(*per_year.values())
    for key in everywhere - seen:
        assert key not in target
        assert float(np.median([per_year[b].get(key, 0.0) for b in baseline_years])) < 0.05


def test_cells_are_inside_the_box_and_in_order(client, box):
    data = get(client, box, year=2023, month=7, step=1)
    keys = [(x, y) for x, y, *_ in data["cells"]]
    assert keys == sorted(keys)
    assert len(set(keys)) == len(keys)
    for x, y in keys:
        assert -1160 <= x <= -1141
        assert 610 <= y <= 629


def test_big_fire_month_is_unusual(client, box):
    data = get(client, box, year=2023, month=7, step=10)
    assert len(data["cells"]) <= 4
    # The fire is in some cells and not others: where it burned, it is far above the usual July.
    burning = [cell for cell in data["cells"] if cell[2] > 0]
    assert len(burning) >= 1
    for _, _, harmonized, median, percentile in burning:
        assert harmonized > 3 * median
        assert percentile >= 90
    # Where nothing burned this time, the cell is still listed, below its usual value.
    for _, _, harmonized, median, percentile in data["cells"]:
        if harmonized == 0:
            assert median > 0
            assert percentile == 0.0


def test_quiet_cells_with_a_usual_fire_are_included(client, box):
    # In a month with almost nothing burning, cells that usually burn still show up, with a value below the median.
    data = get(client, box, year=2026, month=11, step=10)
    assert all(harmonized > 0 or median > 0 for _, _, harmonized, median, _ in data["cells"])


def test_default_step_follows_box_width(client):
    def step_for(west, east):
        params = {"west": west, "south": 61.0, "east": east, "north": 63.0, "year": 2023, "month": 7}
        return client.get("/api/anomaly", params=params).json()["step"]

    assert step_for(-116.0, -114.0) == 1
    assert step_for(-120.0, -105.0) == 1  # 15 degrees wide
    assert step_for(-120.0, -104.9) == 5
    assert step_for(-150.0, -90.0) == 5  # 60 degrees wide
    assert step_for(-150.0, -89.9) == 10


def test_partial_month_is_allowed_and_not_scaled(client, box):
    data = get(client, box, year=2026, month=11, step=10)
    values = {(x, y): harmonized for x, y, harmonized, _, _ in data["cells"] if harmonized > 0}
    assert values == grid_cells(client, box, 2026, 11, 10)


def test_empty_area(client):
    data = get(client, EMPTY_BOX, year=2023, month=7)
    assert data["cells"] == []
    assert data["step"] == 1


def test_bbox_is_snapped_outward(client):
    box = {"west": -115.55, "south": 61.42, "east": -114.48, "north": 62.13}
    data = get(client, box, year=2023, month=7)
    assert data["bbox"] == {"west": -115.6, "south": 61.4, "east": -114.4, "north": 62.2}
    for x, y, *_ in data["cells"]:
        assert -1156 <= x <= -1145
        assert 614 <= y <= 621


@pytest.mark.parametrize(
    "params",
    [
        {"year": 2023, "month": 13},
        {"year": 2023, "month": 0},
        {"year": 2002, "month": 12},  # before the record starts
        {"year": 2026, "month": 12},  # after the latest data
        {"year": 2023, "month": 7, "step": 2},
        {"year": 2023, "month": 7, "step": 0},
    ],
)
def test_bad_values_return_400(client, box, params):
    response = client.get("/api/anomaly", params={**box, **params})
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)


def test_bad_box_and_missing_parameters(client, box):
    bad = {**box, "west": box["east"], "year": 2023, "month": 7}
    assert client.get("/api/anomaly", params=bad).status_code == 400
    assert client.get("/api/anomaly", params={**box, "year": 2023}).status_code == 422
    assert client.get("/api/anomaly", params={**box, "month": 7}).status_code == 422
    assert client.get("/api/anomaly", params={**box, "year": "x", "month": 7}).status_code == 422
    missing = {k: v for k, v in box.items() if k != "east"}
    assert client.get("/api/anomaly", params={**missing, "year": 2023, "month": 7}).status_code == 422
