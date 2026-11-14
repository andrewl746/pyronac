"""GET /api/compare: one month against the same calendar month in other years. Feature F4. MASTERSPEC section 7."""
import calendar

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import config, db, periods
from ..analysis.stats import compare_stats
from ..deps import Bbox, bbox_params

router = APIRouter()


@router.get("/compare")
def compare(
    bbox: Bbox = Depends(bbox_params),
    year: int | None = Query(None, description="Target year. Default: the latest complete month"),
    month: int | None = Query(None, description="Target month, 1 to 12. Give it together with year"),
    baseline_start: int = Query(2003, ge=2003, description="First baseline year"),
    baseline_end: int | None = Query(None, description="Last baseline year. Default: the year of the latest complete month"),
):
    if (year is None) != (month is None):
        raise HTTPException(status_code=400, detail="Give both year and month, or neither.")
    if year is None:
        year, month = periods.last_complete_month()
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Invalid month: it must be 1 to 12.")
    last_year, last_month = periods.last_month()
    if year * 100 + month < config.FIRST_YM or (year, month) > (last_year, last_month):
        raise HTTPException(
            status_code=400,
            detail=f"No data for that month. The record runs from 2003-01 to {periods.month_string(last_year, last_month)}.",
        )
    if baseline_end is None:
        baseline_end = periods.last_complete_month()[0]

    # Every year in the range except the target year, and only where that calendar month is complete.
    baseline_years = [
        y for y in range(baseline_start, baseline_end + 1)
        if y != year and periods.is_complete(y, month)
    ]
    if not baseline_years:
        raise HTTPException(
            status_code=400,
            detail="No baseline years: no other year from baseline_start to baseline_end has that month complete.",
        )

    rows = db.query(
        """
        SELECT year, sum(harmonized_count) AS harmonized
        FROM grid
        WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?
          AND month = ?
        GROUP BY year
        """,
        [bbox.x0, bbox.x1, bbox.y0, bbox.y1, month],
    )
    # A year with no row had no detections. Rounded the same way as /api/calendar.
    totals = {row["year"]: round(float(row["harmonized"] or 0), 1) for row in rows}

    target = totals.get(year, 0.0)
    history = [{"year": y, "harmonized": totals.get(y, 0.0)} for y in baseline_years]
    stats = compare_stats(target, [entry["harmonized"] for entry in history])

    complete = periods.is_complete(year, month)
    days_covered = calendar.monthrange(year, month)[1] if complete else periods.data_through().day

    return {
        "bbox": bbox.as_dict(),
        "target": {
            "year": year,
            "month": month,
            "harmonized": target,
            "complete": complete,  # a partial month is returned as it is, never scaled up
            "days_covered": days_covered,
        },
        "baseline": {
            "start_year": baseline_start,
            "end_year": baseline_end,
            "n_years": len(history),
            "median": stats["median"],
            "p25": stats["p25"],
            "p75": stats["p75"],
            "min": stats["min"],
            "max": stats["max"],
        },
        "difference": {
            "absolute": stats["absolute"],
            "percent": stats["percent"],
            "rank": stats["rank"],
            "of": stats["of"],
            "percentile": stats["percentile"],
            "label": stats["label"],
        },
        "history": history,
    }
