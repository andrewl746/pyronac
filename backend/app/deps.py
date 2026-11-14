"""The area box that every endpoint takes.

Copied from MASTERSPEC.md Appendix A. Change only with team agreement.

Use it like this:

    from fastapi import Depends
    from ..deps import Bbox, bbox_params

    @router.get("/something")
    def something(bbox: Bbox = Depends(bbox_params)):
        rows = db.query(
            "SELECT ... FROM grid WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?",
            [bbox.x0, bbox.x1, bbox.y0, bbox.y1],
        )
        return {"bbox": bbox.as_dict(), ...}
"""
import math
from dataclasses import dataclass

from fastapi import HTTPException, Query


@dataclass(frozen=True)
class Bbox:
    # The box after snapping outward to the 0.1 degree grid, in degrees.
    west: float
    south: float
    east: float
    north: float
    # The same box as cell indexes, both ends included.
    x0: int
    x1: int
    y0: int
    y1: int

    def as_dict(self):
        return {"west": self.west, "south": self.south, "east": self.east, "north": self.north}


def bbox_params(
    west: float = Query(..., ge=-180, le=180, description="Western edge, degrees"),
    south: float = Query(..., ge=-90, le=90, description="Southern edge, degrees"),
    east: float = Query(..., ge=-180, le=180, description="Eastern edge, degrees"),
    north: float = Query(..., ge=-90, le=90, description="Northern edge, degrees"),
) -> Bbox:
    if not (west < east and south < north):
        raise HTTPException(status_code=400, detail="Invalid box: need west < east and south < north.")
    # round() first so that -114.4 * 10 is -1144 and not -1144.0000000000002
    x0 = math.floor(round(west * 10, 6))
    x1 = math.ceil(round(east * 10, 6)) - 1
    y0 = math.floor(round(south * 10, 6))
    y1 = math.ceil(round(north * 10, 6)) - 1
    return Bbox(
        west=x0 / 10, south=y0 / 10, east=(x1 + 1) / 10, north=(y1 + 1) / 10,
        x0=x0, x1=x1, y0=y0, y1=y1,
    )
