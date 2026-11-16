"""GET /api/trend on the fixtures."""
import pytest
from scipy.stats import linregress

FIT_FIELDS = {"slope_per_year", "percent_per_decade", "p_value", "direction"}
DIRECTIONS = {"increasing", "decreasing", "no clear trend"}

# A box in the middle of the Pacific: no fires, ever.
EMPTY_BOX = {"west": -150.0, "south": 10.0, "east": -149.0, "north": 11.0}


@pytest.fixture(scope="module")
def cal(client, box):
    """/api/calendar for the fixture box, as a list of month entries."""
    response = client.get("/api/calendar", params={**box, "start_year": 2003, "end_year": 2026})
    assert response.status_code == 200
    return response.json()["months"]


@pytest.fixture(scope="module")
def trend(client, box):
    response = client.get("/api/trend", params=box)
    assert response.status_code == 200, response.text
    return response.json()


def test_fields_match_types_ts(trend, box):
    assert set(trend) == {
        "bbox", "start_year", "end_year", "years", "harmonized_trend", "raw_trend", "season_shift",
    }
    for entry in trend["years"]:
        assert set(entry) == {"year", "harmonized", "raw", "season_center"}
    assert set(trend["harmonized_trend"]) == FIT_FIELDS
    assert set(trend["raw_trend"]) == FIT_FIELDS
    assert set(trend["season_shift"]) == {"days_per_decade", "p_value"}
    assert trend["harmonized_trend"]["direction"] in DIRECTIONS
    assert trend["raw_trend"]["direction"] in DIRECTIONS
    assert trend["bbox"] == box


def test_default_is_every_full_year(trend):
    # Data runs to 6 November 2026, so 2025 is the latest year with a complete December.
    assert trend["start_year"] == 2003
    assert trend["end_year"] == 2025
    assert [entry["year"] for entry in trend["years"]] == list(range(2003, 2026))
    assert len(trend["years"]) == 23


def test_yearly_totals_equal_calendar_sums(trend, cal):
    """B12."""
    for entry in trend["years"]:
        months = [m for m in cal if m["year"] == entry["year"]]
        assert len(months) == 12
        assert entry["harmonized"] == pytest.approx(sum(m["harmonized"] for m in months), abs=1e-6)
        assert entry["raw"] == sum(m["raw"] for m in months)
        assert isinstance(entry["raw"], int)


def test_season_center_is_the_weighted_average_month(trend, cal):
    for entry in trend["years"]:
        months = [m for m in cal if m["year"] == entry["year"]]
        total = sum(m["harmonized"] for m in months)
        assert total > 0
        by_hand = sum(m["month"] * m["harmonized"] for m in months) / total
        assert entry["season_center"] == pytest.approx(by_hand, abs=0.006)
        assert 1 <= entry["season_center"] <= 12


def test_raw_trend_is_much_steeper_than_harmonized(trend):
    # The raw record jumps when VIIRS takes over from MODIS in 2012. Harmonizing removes that.
    raw = trend["raw_trend"]["slope_per_year"]
    harmonized = trend["harmonized_trend"]["slope_per_year"]
    assert raw > 0
    assert raw > 3 * abs(harmonized)
    assert trend["raw_trend"]["percent_per_decade"] > trend["harmonized_trend"]["percent_per_decade"]


def test_fits_match_scipy(trend):
    years = [entry["year"] for entry in trend["years"]]
    for key, field in (("harmonized_trend", "harmonized"), ("raw_trend", "raw")):
        values = [entry[field] for entry in trend["years"]]
        fit = linregress(years, values)
        mean = sum(values) / len(values)
        assert trend[key]["slope_per_year"] == pytest.approx(fit.slope, abs=0.051)
        assert trend[key]["percent_per_decade"] == pytest.approx(fit.slope * 10 / mean * 100, abs=0.051)
        assert trend[key]["p_value"] == pytest.approx(fit.pvalue, abs=0.00006)
        if fit.pvalue < 0.05:
            assert trend[key]["direction"] == ("increasing" if fit.slope > 0 else "decreasing")
        else:
            assert trend[key]["direction"] == "no clear trend"

    centers = [entry["season_center"] for entry in trend["years"]]
    fit = linregress(years, centers)
    assert trend["season_shift"]["days_per_decade"] == pytest.approx(fit.slope * 10 * 30.44, abs=0.051)
    assert trend["season_shift"]["p_value"] == pytest.approx(fit.pvalue, abs=0.00006)


def test_year_range(client, box, trend):
    response = client.get("/api/trend", params={**box, "start_year": 2012, "end_year": 2019})
    assert response.status_code == 200
    data = response.json()
    assert (data["start_year"], data["end_year"]) == (2012, 2019)
    assert [entry["year"] for entry in data["years"]] == list(range(2012, 2020))
    whole = {entry["year"]: entry for entry in trend["years"]}
    for entry in data["years"]:
        assert entry == whole[entry["year"]]


def test_three_years_is_enough_and_season_shift_needs_five(client, box):
    response = client.get("/api/trend", params={**box, "start_year": 2020, "end_year": 2022})
    assert response.status_code == 200
    data = response.json()
    assert len(data["years"]) == 3
    assert data["season_shift"] is None

    response = client.get("/api/trend", params={**box, "start_year": 2020, "end_year": 2024})
    assert response.json()["season_shift"] is not None


def test_empty_area(client):
    response = client.get("/api/trend", params=EMPTY_BOX)
    assert response.status_code == 200
    data = response.json()
    assert len(data["years"]) == 23
    for entry in data["years"]:
        assert entry["harmonized"] == 0.0
        assert entry["raw"] == 0
        assert entry["season_center"] is None
    for key in ("harmonized_trend", "raw_trend"):
        assert data[key] == {
            "slope_per_year": 0.0,
            "percent_per_decade": None,
            "p_value": 1.0,
            "direction": "no clear trend",
        }
    assert data["season_shift"] is None


def test_bbox_is_snapped_outward(client):
    response = client.get("/api/trend", params={"west": -115.55, "south": 61.42, "east": -114.48, "north": 62.13})
    assert response.json()["bbox"] == {"west": -115.6, "south": 61.4, "east": -114.4, "north": 62.2}


@pytest.mark.parametrize(
    "params",
    [
        {"start_year": 2024, "end_year": 2025},  # 2 years
        {"start_year": 2025, "end_year": 2025},
        {"start_year": 2020, "end_year": 2010},
        {"start_year": 2024},  # 2024 and 2025 only
        {"start_year": 2003, "end_year": 2030},  # after the latest data
    ],
)
def test_bad_values_return_400(client, box, params):
    response = client.get("/api/trend", params={**box, **params})
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)


def test_bad_box_and_missing_parameters(client, box):
    bad = {**box, "south": box["north"]}
    assert client.get("/api/trend", params=bad).status_code == 400
    missing = {k: v for k, v in box.items() if k != "west"}
    assert client.get("/api/trend", params=missing).status_code == 422
    assert client.get("/api/trend", params={**box, "start_year": 1999}).status_code == 422
    assert client.get("/api/trend", params={**box, "end_year": "soon"}).status_code == 422
