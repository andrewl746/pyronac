"""GET /api/grid: harmonized totals per cell for a box and a period. Feeds the map."""
from fastapi import APIRouter, Depends, HTTPException, Query

from .. import db, periods
from ..deps import Bbox, bbox_params

router = APIRouter()

STEPS = (1, 5, 10)


def default_step(bbox: Bbox) -> int:
    """How many 0.1 degree cells to merge along each side, from the width of the snapped box."""
    width_degrees = (bbox.x1 - bbox.x0 + 1) / 10
    if width_degrees <= 15:
        return 1
    if width_degrees <= 60:
        return 5
    return 10


@router.get("/grid")
def grid(
    bbox: Bbox = Depends(bbox_params),
    start: str = Query(..., description='First month, "YYYY-MM", included'),
    end: str = Query(..., description='Last month, "YYYY-MM", included'),
    step: int | None = Query(None, description="Cells merged along each side: 1, 5 or 10"),
):
    first = periods.parse_month(start)
    last = periods.parse_month(end)
    if first is None or last is None:
        raise HTTPException(status_code=400, detail='Invalid month: start and end must look like "2023-07".')
    if first > last:
        raise HTTPException(status_code=400, detail="Invalid period: start must not be after end.")
    if step is None:
        step = default_step(bbox)
    elif step not in STEPS:
        raise HTTPException(status_code=400, detail="Invalid step: it must be 1, 5 or 10.")

    rows = db.query(
        """
        SELECT
            CAST(floor(cell_x / CAST(? AS DOUBLE)) AS INTEGER) AS x,
            CAST(floor(cell_y / CAST(? AS DOUBLE)) AS INTEGER) AS y,
            sum(harmonized_count) AS harmonized
        FROM grid
        WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?
          AND ym BETWEEN ? AND ?
        GROUP BY 1, 2
        ORDER BY 1, 2
        """,
        [
            step, step,
            bbox.x0, bbox.x1, bbox.y0, bbox.y1,
            first[0] * 100 + first[1], last[0] * 100 + last[1],
        ],
    )
    cells = [[row["x"], row["y"], round(float(row["harmonized"]), 1)] for row in rows]
    cells = [cell for cell in cells if cell[2] > 0]
    return {
        "bbox": bbox.as_dict(),
        "start": start,
        "end": end,
        "step": step,
        "cells": cells,
        "max": max((cell[2] for cell in cells), default=0.0),
    }
