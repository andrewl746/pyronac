"""GET /api/calendar and /api/calendar.csv: monthly totals for a box. MASTERSPEC section 7."""
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from .. import config, db, periods
from ..deps import Bbox, bbox_params

router = APIRouter()

CSV_HEADER = ["year", "month", "harmonized", "raw", "modis", "viirs", "era", "complete"]


def build_calendar(bbox: Bbox, start_year: int, end_year: int | None) -> dict:
    """The CalendarResponse for a box: every month in range, empty ones included."""
    last_year, last_month = periods.last_month()
    if end_year is None:
        end_year = last_year
    if start_year > end_year:
        raise HTTPException(status_code=400, detail="Invalid years: start_year must not be after end_year.")

    rows = db.query(
        """
        SELECT
            year,
            month,
            sum(harmonized_count) AS harmonized,
            sum(raw_count) AS raw,
            sum(modis_count) AS modis,
            sum(viirs_count) AS viirs
        FROM grid
        WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?
          AND year BETWEEN ? AND ?
        GROUP BY year, month
        """,
        [bbox.x0, bbox.x1, bbox.y0, bbox.y1, start_year, end_year],
    )
    sums = {(row["year"], row["month"]): row for row in rows}

    months = []
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            if (year, month) > (last_year, last_month):
                break
            row = sums.get((year, month), {})
            era = config.era_of(year, month)
            months.append(
                {
                    "year": year,
                    "month": month,
                    "harmonized": round(float(row.get("harmonized") or 0), 1),
                    "raw": int(row.get("raw") or 0),
                    "modis": int(row.get("modis") or 0),
                    "viirs": None if era == "modis" else int(row.get("viirs") or 0),
                    "era": era,
                    "complete": periods.is_complete(year, month),
                }
            )
    return {
        "bbox": bbox.as_dict(),
        "start_year": start_year,
        "end_year": end_year,
        "months": months,
        "max_harmonized": max((m["harmonized"] for m in months), default=0.0),
        "max_raw": max((m["raw"] for m in months), default=0),
    }


@router.get("/calendar")
def calendar(
    bbox: Bbox = Depends(bbox_params),
    start_year: int = Query(2003, ge=2003, description="First year"),
    end_year: int | None = Query(None, description="Last year. Default: the year of the latest data"),
):
    return build_calendar(bbox, start_year, end_year)


@router.get("/calendar.csv")
def calendar_csv(
    bbox: Bbox = Depends(bbox_params),
    start_year: int = Query(2003, ge=2003, description="First year"),
    end_year: int | None = Query(None, description="Last year. Default: the year of the latest data"),
):
    data = build_calendar(bbox, start_year, end_year)
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(CSV_HEADER)
    for m in data["months"]:
        writer.writerow(
            [
                m["year"],
                m["month"],
                f"{m['harmonized']:.1f}",
                m["raw"],
                m["modis"],
                "" if m["viirs"] is None else m["viirs"],
                m["era"],
                "true" if m["complete"] else "false",
            ]
        )
    filename = f"fire_calendar_{data['start_year']}_{data['end_year']}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
