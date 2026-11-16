// Box and grid geometry.
import type { FeatureCollection, Polygon } from "geojson";
import type { Bbox } from "../api/types";

// The map's view when no box is selected.
export const WORLD: Bbox = { west: -180, south: -90, east: 180, north: 90 };
// ...asked for in 1 degree cells.
export const WORLD_STEP = 10;

// Degrees times 10, rounded to 6 places first so -114.4 * 10 is -1144 and not -1144.0000000000002.
function tenths(degrees: number): number {
  return Math.round(degrees * 10 * 1e6) / 1e6;
}

// Snap a box outward to whole 0.1 degree cells, with the same rule as backend/app/deps.py:
// floor the west and south edges, ceil the east and north edges.
// Everything calls this before setBbox.
export function snapBbox(bbox: Bbox): Bbox {
  return {
    west: Math.floor(tenths(bbox.west)) / 10,
    south: Math.floor(tenths(bbox.south)) / 10,
    east: Math.ceil(tenths(bbox.east)) / 10,
    north: Math.ceil(tenths(bbox.north)) / 10,
  };
}

export type CellProperties = { value: number };

// One square per grid cell. A cell [x, y, value] at `step` covers longitude x*step/10 to
// (x+1)*step/10 and latitude y*step/10 to (y+1)*step/10.
export function cellsToGeoJSON(
  cells: [number, number, number][],
  step: number,
): FeatureCollection<Polygon, CellProperties> {
  return {
    type: "FeatureCollection",
    features: cells.map(([x, y, value]) => {
      const west = (x * step) / 10;
      const east = ((x + 1) * step) / 10;
      const south = (y * step) / 10;
      const north = ((y + 1) * step) / 10;
      return {
        type: "Feature",
        properties: { value },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    }),
  };
}

type Corner = { lng: number; lat: number };

// The box a drag between two corners covers, going the short way round in longitude, so a drag
// from 178°E to 178°W is 4° wide, not 356°. When the drag crosses the 180° line, west comes out
// below -180 or east above 180: check with crossesDateLine.
export function dragBox(a: Corner, b: Corner): Bbox {
  const span = ((b.lng - a.lng + 540) % 360) - 180; // signed, -180 to 180 degrees
  const otherEnd = a.lng + span;
  return {
    west: Math.min(a.lng, otherEnd),
    east: Math.max(a.lng, otherEnd),
    south: Math.max(-90, Math.min(a.lat, b.lat)),
    north: Math.min(90, Math.max(a.lat, b.lat)),
  };
}

// The API cannot take a box across the 180° line: deps.py needs west < east within -180 to 180.
export function crossesDateLine(bbox: Bbox): boolean {
  return bbox.west < -180 || bbox.east > 180;
}
