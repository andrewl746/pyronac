"""GET /api/anomaly: how unusual one month is, cell by cell. Feeds the anomaly map. MASTERSPEC section 7."""
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query

from .. import config, db, periods
from ..deps import Bbox, bbox_params
from .grid import STEPS, default_step  # the same step rule as /api/grid

router = APIRouter()


@router.get("/anomaly")
def anomaly(
    bbox: Bbox = Depends(bbox_params),
    year: int = Query(..., description="Target year"),
    month: int = Query(..., description="Target month, 1 to 12"),
    step: int | None = Query(None, description="Cells merged along each side: 1, 5 or 10"),
):
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Invalid month: it must be 1 to 12.")
    last_year, last_month = periods.last_month()
    if year * 100 + month < config.FIRST_YM or (year, month) > (last_year, last_month):
        raise HTTPException(
            status_code=400,
            detail=f"No data for that month. The record runs from 2003-01 to {periods.month_string(last_year, last_month)}.",
        )
    if step is None:
        step = default_step(bbox)
    elif step not in STEPS:
        raise HTTPException(status_code=400, detail="Invalid step: it must be 1, 5 or 10.")

    # The same calendar month in every other complete year from 2003, as in /api/compare.
    baseline_years = [
        y for y in range(config.FIRST_YM // 100, last_year + 1)
        if y != year and periods.is_complete(y, month)
    ]
    if not baseline_years:
        raise HTTPException(status_code=400, detail="No other complete year to compare that month with.")

    rows = db.query(
        """
        SELECT
            CAST(floor(cell_x / CAST(? AS DOUBLE)) AS INTEGER) AS x,
            CAST(floor(cell_y / CAST(? AS DOUBLE)) AS INTEGER) AS y,
            year,
            sum(harmonized_count) AS harmonized
        FROM grid
        WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?
          AND month = ?
        GROUP BY 1, 2, 3
        """,
        [step, step, bbox.x0, bbox.x1, bbox.y0, bbox.y1, month],
    )

    # One row per merged cell, one column per baseline year. A missing value is zero.
    cell_index = {key: i for i, key in enumerate(sorted({(row["x"], row["y"]) for row in rows}))}
    year_index = {y: i for i, y in enumerate(baseline_years)}
    target = np.zeros(len(cell_index))
    history = np.zeros((len(cell_index), len(baseline_years)))
    for row in rows:
        i = cell_index[(row["x"], row["y"])]
        value = round(float(row["harmonized"] or 0), 1)
        if row["year"] == year:
            target[i] = value
        elif row["year"] in year_index:
            history[i, year_index[row["year"]]] = value

    cells = []
    if cell_index:
        medians = np.median(history, axis=1)
        # 100 times the share of baseline years strictly below the target.
        percentiles = 100 * (history < target[:, None]).sum(axis=1) / len(baseline_years)
        for (x, y), i in cell_index.items():
            value = float(target[i])
            median = round(float(medians[i]), 1)
            if value > 0 or median > 0:
                cells.append([x, y, value, median, round(float(percentiles[i]), 1)])

    return {
        "bbox": bbox.as_dict(),
        "year": year,
        "month": month,
        "step": step,
        "cells": cells,
    }
