"""The maths behind /api/compare and /api/trend. MASTERSPEC section 7.

Pure functions: no database, no FastAPI. The routers fetch the numbers and call these.
"""
import math

import numpy as np
from scipy.stats import linregress

DAYS_PER_MONTH = 30.44


def label_for(percentile: float) -> str:
    """The words for a percentile, 0 to 100."""
    if percentile >= 90:
        return "well above normal"
    if percentile >= 75:
        return "above normal"
    if percentile > 25:
        return "near normal"
    if percentile > 10:
        return "below normal"
    return "well below normal"


def compare_stats(target: float, history: list[float]) -> dict:
    """Returns median, p25, p75, min, max, absolute, percent, rank, of, percentile, label.
    Exactly the rules under GET /api/compare in section 7."""
    if len(history) == 0:
        raise ValueError("history must have at least one value")
    values = np.asarray(history, dtype=float)
    p25, median, p75 = (float(v) for v in np.percentile(values, [25, 50, 75]))
    absolute = target - median
    percentile = round(100 * int((values < target).sum()) / len(values), 1)
    return {
        "median": round(median, 1),
        "p25": round(p25, 1),
        "p75": round(p75, 1),
        "min": round(float(values.min()), 1),
        "max": round(float(values.max()), 1),
        "absolute": round(absolute, 1),
        "percent": None if median == 0 else round(absolute / median * 100, 1),
        "rank": 1 + int((values > target).sum()),
        "of": len(values) + 1,
        "percentile": percentile,
        "label": label_for(percentile),
    }


def _fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """A straight line through the points: (slope, p_value). Needs 3 or more points."""
    if len(xs) != len(ys):
        raise ValueError("years and values must be the same length")
    if len(xs) < 3:
        raise ValueError("a trend needs at least 3 points")
    result = linregress(xs, ys)
    slope = float(result.slope)
    p_value = float(result.pvalue)
    # A flat or degenerate series has no trend. Keep the JSON free of NaN.
    if math.isnan(slope):
        slope = 0.0
    if math.isnan(p_value):
        p_value = 1.0
    return slope, p_value


def linear_trend(years: list[int], values: list[float]) -> dict:
    """Returns slope_per_year, percent_per_decade, p_value, direction. Section 7, GET /api/trend."""
    slope, p_value = _fit(years, values)
    mean = sum(values) / len(values)
    if p_value < 0.05 and slope != 0:
        direction = "increasing" if slope > 0 else "decreasing"
    else:
        direction = "no clear trend"
    return {
        "slope_per_year": round(slope, 1) + 0.0,  # + 0.0 turns -0.0 into 0.0
        "percent_per_decade": None if mean == 0 else round(slope * 10 / mean * 100, 1) + 0.0,
        "p_value": round(p_value, 4),
        "direction": direction,
    }


def season_shift(years: list[int], centers: list[float | None]) -> dict | None:
    """How fast the middle of the fire season is moving: days_per_decade and p_value.

    centers holds each year's season_center, None for a year with no fire.
    Returns None when fewer than 5 years have one.
    """
    pairs = [(year, center) for year, center in zip(years, centers) if center is not None]
    if len(pairs) < 5:
        return None
    slope, p_value = _fit([year for year, _ in pairs], [center for _, center in pairs])
    return {
        "days_per_decade": round(slope * 10 * DAYS_PER_MONTH, 1) + 0.0,
        "p_value": round(p_value, 4),
    }
