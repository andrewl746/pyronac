"""GET /api/trend: yearly totals for a box, harmonized against raw, with fitted trends. MASTERSPEC section 7."""
from fastapi import APIRouter, Depends, HTTPException, Query

from .. import db, periods
from ..analysis.stats import linear_trend, season_shift
from ..deps import Bbox, bbox_params

router = APIRouter()


def last_full_year() -> int:
    """The latest year whose December is complete."""
    year, month = periods.last_complete_month()
    return year if month == 12 else year - 1


@router.get("/trend")
def trend(
    bbox: Bbox = Depends(bbox_params),
    start_year: int = Query(2003, ge=2003, description="First year"),
    end_year: int | None = Query(None, description="Last year. Default: the latest year whose December is complete"),
):
    if end_year is None:
        end_year = last_full_year()
    if end_year > periods.last_month()[0]:
        raise HTTPException(status_code=400, detail="Invalid years: end_year is after the latest data.")
    if end_year - start_year + 1 < 3:
        raise HTTPException(status_code=400, detail="A trend needs at least 3 years.")

    rows = db.query(
        """
        SELECT
            year,
            month,
            sum(harmonized_count) AS harmonized,
            sum(raw_count) AS raw
        FROM grid
        WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?
          AND year BETWEEN ? AND ?
        GROUP BY year, month
        """,
        [bbox.x0, bbox.x1, bbox.y0, bbox.y1, start_year, end_year],
    )

    # Each month is rounded the same way as /api/calendar before it is added up,
    # so a year here is exactly the sum of that year's months there.
    harmonized = {year: 0.0 for year in range(start_year, end_year + 1)}
    weighted = dict(harmonized)
    raw = {year: 0 for year in harmonized}
    for row in rows:
        value = round(float(row["harmonized"] or 0), 1)
        harmonized[row["year"]] += value
        weighted[row["year"]] += row["month"] * value
        raw[row["year"]] += int(row["raw"] or 0)

    years = []
    for year in range(start_year, end_year + 1):
        total = round(harmonized[year], 1)
        years.append(
            {
                "year": year,
                "harmonized": total,
                "raw": raw[year],
                # The average month number, weighted by how much burned in each month.
                "season_center": None if total == 0 else round(weighted[year] / harmonized[year], 2),
            }
        )

    numbers = [entry["year"] for entry in years]
    return {
        "bbox": bbox.as_dict(),
        "start_year": start_year,
        "end_year": end_year,
        "years": years,
        "harmonized_trend": linear_trend(numbers, [entry["harmonized"] for entry in years]),
        "raw_trend": linear_trend(numbers, [entry["raw"] for entry in years]),
        "season_shift": season_shift(numbers, [entry["season_center"] for entry in years]),
    }
