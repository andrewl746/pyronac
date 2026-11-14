"""GET /api/points/count and /api/points.csv: the raw detections in a box. MASTERSPEC section 7.

These are what the satellites reported, not harmonized values.
"""
import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from .. import config, db, periods
from ..deps import Bbox, bbox_params

router = APIRouter()

CSV_COLUMNS = ["latitude", "longitude", "acq_date", "acq_time", "sensor", "satellite", "confidence", "frp", "daynight"]
SENSORS = {"all": None, "modis": "MODIS", "viirs": "VIIRS"}


def points_filter(bbox: Bbox, start: str, end: str, sensor: str) -> tuple[str, list]:
    """Check the request and return the WHERE clause and its parameters."""
    first = periods.parse_date(start)
    last = periods.parse_date(end)
    if first is None or last is None:
        raise HTTPException(status_code=400, detail='Invalid date: start and end must look like "2023-07-31".')
    if first > last:
        raise HTTPException(status_code=400, detail="Invalid dates: start must not be after end.")
    if sensor not in SENSORS:
        raise HTTPException(status_code=400, detail="Invalid sensor: it must be all, modis or viirs.")

    where = (
        "cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ? "
        "AND acq_date BETWEEN ? AND ? "
        "AND year BETWEEN ? AND ?"  # lets DuckDB skip whole year folders
    )
    params: list = [bbox.x0, bbox.x1, bbox.y0, bbox.y1, first, last, first.year, last.year]
    if SENSORS[sensor] is not None:
        where += " AND sensor = ?"
        params.append(SENSORS[sensor])
    return where, params


def count_points(where: str, params: list) -> int:
    return db.query(f"SELECT count(*) AS n FROM points WHERE {where}", params)[0]["n"]


def csv_lines(where: str, params: list, batch: int = 5_000):
    """Yield the CSV as text, a few thousand lines at a time."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    pending = 0
    rows = db.stream(
        f"""
        SELECT {", ".join(CSV_COLUMNS)}
        FROM points
        WHERE {where}
        ORDER BY acq_date, acq_time, latitude, longitude
        """,
        params,
    )
    for row in rows:
        writer.writerow([value.isoformat() if isinstance(value, date) else value for value in row])
        pending += 1
        if pending >= batch:
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate()
            pending = 0
    yield buffer.getvalue()


@router.get("/points/count")
def points_count(
    bbox: Bbox = Depends(bbox_params),
    start: str = Query(..., description='First day, "YYYY-MM-DD", included'),
    end: str = Query(..., description='Last day, "YYYY-MM-DD", included'),
    sensor: str = Query("all", description="all, modis or viirs"),
):
    where, params = points_filter(bbox, start, end, sensor)
    return {"count": count_points(where, params)}


@router.get("/points.csv")
def points_csv(
    bbox: Bbox = Depends(bbox_params),
    start: str = Query(..., description='First day, "YYYY-MM-DD", included'),
    end: str = Query(..., description='Last day, "YYYY-MM-DD", included'),
    sensor: str = Query("all", description="all, modis or viirs"),
):
    where, params = points_filter(bbox, start, end, sensor)
    count = count_points(where, params)
    if count > config.MAX_CSV_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many hot spots ({count}). Choose a smaller area or a shorter date range.",
        )
    return StreamingResponse(
        csv_lines(where, params),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="hotspots_{start}_{end}.csv"'},
    )
