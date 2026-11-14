"""analysis/stats.py: pure functions, checked against cases worked by hand."""
import pytest

from app.analysis.stats import compare_stats, label_for, linear_trend, season_shift

COMPARE_FIELDS = {
    "median", "p25", "p75", "min", "max",
    "absolute", "percent", "rank", "of", "percentile", "label",
}
TREND_FIELDS = {"slope_per_year", "percent_per_decade", "p_value", "direction"}


def test_compare_stats_task_sheet_case():
    # Sorted history 10, 20, 30, 40. Median is halfway between 20 and 30.
    result = compare_stats(30, [10, 20, 30, 40])
    assert set(result) == COMPARE_FIELDS
    assert result["median"] == 25.0
    assert result["p25"] == 17.5
    assert result["p75"] == 32.5
    assert result["min"] == 10.0
    assert result["max"] == 40.0
    assert result["absolute"] == 5.0
    assert result["percent"] == 20.0
    assert result["rank"] == 2  # only 40 is strictly above 30
    assert result["of"] == 5
    assert result["percentile"] == 50.0  # 10 and 20 are strictly below: 2 of 4
    assert result["label"] == "near normal"


def test_compare_stats_all_zero_history():
    result = compare_stats(5, [0, 0, 0, 0])
    assert result["median"] == 0.0
    assert result["absolute"] == 5.0
    assert result["percent"] is None
    assert result["rank"] == 1
    assert result["of"] == 5
    assert result["percentile"] == 100.0
    assert result["label"] == "well above normal"


def test_compare_stats_nothing_anywhere():
    result = compare_stats(0, [0, 0, 0])
    assert result["percent"] is None
    assert result["rank"] == 1  # nothing is strictly above
    assert result["percentile"] == 0.0  # nothing is strictly below
    assert result["label"] == "well below normal"


def test_compare_stats_ties_use_strict_comparisons():
    result = compare_stats(20, [20, 20, 20, 20])
    assert result["rank"] == 1
    assert result["percentile"] == 0.0
    assert result["absolute"] == 0.0
    assert result["percent"] == 0.0


def test_compare_stats_order_of_history_does_not_matter():
    assert compare_stats(30, [40, 10, 30, 20]) == compare_stats(30, [10, 20, 30, 40])


def test_compare_stats_below_the_median():
    # Median 30. Target 12 is above only the 10.
    result = compare_stats(12, [10, 20, 30, 40, 50])
    assert result["median"] == 30.0
    assert result["absolute"] == -18.0
    assert result["percent"] == -60.0
    assert result["rank"] == 5
    assert result["of"] == 6
    assert result["percentile"] == 20.0
    assert result["label"] == "below normal"


def test_compare_stats_rounds_to_one_place():
    # Median 3. (4 - 3) / 3 * 100 = 33.33...
    result = compare_stats(4, [1, 3, 5])
    assert result["percent"] == 33.3
    assert result["percentile"] == 66.7  # 2 of 3 strictly below


def test_compare_stats_needs_history():
    with pytest.raises(ValueError):
        compare_stats(5, [])


@pytest.mark.parametrize(
    "percentile, label",
    [
        (100, "well above normal"),
        (90, "well above normal"),
        (89.9, "above normal"),
        (75, "above normal"),
        (74.9, "near normal"),
        (25.1, "near normal"),
        (25, "below normal"),
        (10.1, "below normal"),
        (10, "well below normal"),
        (0, "well below normal"),
    ],
)
def test_label_boundaries(percentile, label):
    assert label_for(percentile) == label


def test_linear_trend_task_sheet_case():
    result = linear_trend([2003, 2004, 2005, 2006], [10, 20, 30, 40])
    assert set(result) == TREND_FIELDS
    assert result["slope_per_year"] == 10.0
    assert result["direction"] == "increasing"
    assert result["p_value"] < 0.05
    # Mean 25. A slope of 10 a year is 100 a decade, which is 400% of the mean.
    assert result["percent_per_decade"] == 400.0


def test_linear_trend_decreasing():
    result = linear_trend([2003, 2004, 2005, 2006], [40, 30, 20, 10])
    assert result["slope_per_year"] == -10.0
    assert result["direction"] == "decreasing"
    assert result["percent_per_decade"] == -400.0


def test_linear_trend_flat_series():
    result = linear_trend([2003, 2004, 2005, 2006], [7, 7, 7, 7])
    assert result["slope_per_year"] == 0.0
    assert result["percent_per_decade"] == 0.0
    assert result["p_value"] == 1.0
    assert result["direction"] == "no clear trend"


def test_linear_trend_all_zero():
    result = linear_trend([2003, 2004, 2005], [0, 0, 0])
    assert result["slope_per_year"] == 0.0
    assert result["percent_per_decade"] is None
    assert result["direction"] == "no clear trend"


def test_linear_trend_noise_is_not_a_trend():
    result = linear_trend([2003, 2004, 2005, 2006, 2007, 2008], [10, 30, 12, 28, 11, 29])
    assert result["p_value"] >= 0.05
    assert result["direction"] == "no clear trend"


def test_linear_trend_needs_three_points():
    with pytest.raises(ValueError):
        linear_trend([2003, 2004], [1, 2])
    with pytest.raises(ValueError):
        linear_trend([2003, 2004, 2005], [1, 2])


def test_season_shift():
    # The centre of the season moves 0.1 of a month later every year:
    # 0.1 * 10 years * 30.44 days in a month = 30.4 days per decade.
    years = [2003, 2004, 2005, 2006, 2007]
    centers = [7.0, 7.1, 7.2, 7.3, 7.4]
    result = season_shift(years, centers)
    assert set(result) == {"days_per_decade", "p_value"}
    assert result["days_per_decade"] == 30.4
    assert result["p_value"] < 0.05


def test_season_shift_skips_years_with_no_fire():
    years = [2003, 2004, 2005, 2006, 2007, 2008]
    centers = [7.0, None, 7.2, 7.3, 7.4, 7.5]
    assert season_shift(years, centers)["days_per_decade"] == 30.4


def test_season_shift_needs_five_years_with_fire():
    assert season_shift([2003, 2004, 2005, 2006], [7.0, 7.1, 7.2, 7.3]) is None
    assert season_shift([2003, 2004, 2005, 2006, 2007], [7.0, None, 7.2, 7.3, 7.4]) is None
