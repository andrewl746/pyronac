// Box and grid geometry (MASTERSPEC.md sections 5.4, 7 and 8).
import type { FeatureCollection, Polygon } from "geojson";
import type { Bbox } from "../api/types";

// The map's view when no box is selected.
export const WORLD: Bbox = { west: -180, south: -90, east: 180, north: 90 };

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
