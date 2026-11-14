// How fire shows on the map: each connected burning area gets one red border, and each cell inside
// it is filled with a red gradient. Few hot spots give a faint, see-through dark red; many give a
// solid, bright red. This replaces the colour-ramp fill in MASTERSPEC.md section 8, by Vlad's choice.
import type { FeatureCollection, MultiLineString, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { GridResponse } from "../../api/types";
import { scaleValue } from "../../lib/colors";
import { cellsToGeoJSON, type CellProperties } from "../../lib/geo";

export const FIRE_RED = "#ff3131"; // the border around each burning area

// The gradient, from t = 0 (fewest hot spots) to t = 1 (most). Red keeps getting lighter and more
// opaque as t grows, so the scale reads by lightness too, not by hue alone.
const GRADIENT: { t: number; color: [number, number, number]; opacity: number }[] = [
  { t: 0, color: [122, 12, 12], opacity: 0.3 },
  { t: 0.5, color: [214, 32, 32], opacity: 0.6 },
  { t: 1, color: [255, 64, 48], opacity: 0.92 },
];

const SOURCE_CELLS = "fire-cells";
const SOURCE_OUTLINE = "fire-outline";
export const LAYER_FILL = "fire-fill";
export const FIRE_LAYER_IDS = [LAYER_FILL, "fire-outline"];

// Counts are very uneven, so intensity follows scaleValue (a log scale) from lib/colors.ts.
// The count at a given intensity: the inverse of scaleValue, for the legend.
export function valueAt(t: number, max: number): number {
  return Math.expm1(t * Math.log1p(max));
}

// The fill at intensity t as a CSS colour, the same as the map draws it, for the legend.
export function fireFill(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  // The two stops either side of t (the last stop is t = 1, so one is always found).
  const i = Math.max(1, GRADIENT.findIndex((g) => g.t >= clamped));
  const a = GRADIENT[i - 1];
  const b = GRADIENT[i];
  const f = (clamped - a.t) / (b.t - a.t);
  const mix = (x: number, y: number) => x + (y - x) * f;
  const [r, g, bl] = a.color.map((c, i) => Math.round(mix(c, b.color[i])));
  return `rgba(${r}, ${g}, ${bl}, ${mix(a.opacity, b.opacity).toFixed(2)})`;
}

function gradientExpression(pick: (g: (typeof GRADIENT)[number]) => string | number): ExpressionSpecification {
  const [g0, g1, g2] = GRADIENT;
  return ["interpolate", ["linear"], ["get", "t"], g0.t, pick(g0), g1.t, pick(g1), g2.t, pick(g2)];
}

// The outer border of each connected group of cells: every cell side whose neighbour has no fire.
export function cellOutline(cells: [number, number, number][], step: number): FeatureCollection<MultiLineString> {
  const burning = new Set(cells.map(([x, y]) => `${x},${y}`));
  const degrees = (i: number) => (i * step) / 10;
  const lines: [number, number][][] = [];
  for (const [x, y] of cells) {
    const west = degrees(x);
    const east = degrees(x + 1);
    const south = degrees(y);
    const north = degrees(y + 1);
    if (!burning.has(`${x},${y + 1}`)) lines.push([[west, north], [east, north]]);
    if (!burning.has(`${x},${y - 1}`)) lines.push([[west, south], [east, south]]);
    if (!burning.has(`${x - 1},${y}`)) lines.push([[west, south], [west, north]]);
    if (!burning.has(`${x + 1},${y}`)) lines.push([[east, south], [east, north]]);
  }
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } }],
  };
}

type FireCellProperties = CellProperties & { t: number };

function cellsWithIntensity(grid: GridResponse, max: number): FeatureCollection<Polygon, FireCellProperties> {
  const squares = cellsToGeoJSON(grid.cells, grid.step);
  return {
    ...squares,
    features: squares.features.map((f) => ({
      ...f,
      properties: { ...f.properties, t: scaleValue(f.properties.value, max) },
    })),
  };
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// Adds the two sources and the two layers, under `beforeId`.
export function addFireLayers(map: MapLibreMap, beforeId: string): void {
  map.addSource(SOURCE_CELLS, { type: "geojson", data: EMPTY });
  map.addSource(SOURCE_OUTLINE, { type: "geojson", data: EMPTY });

  map.addLayer(
    {
      id: LAYER_FILL,
      type: "fill",
      source: SOURCE_CELLS,
      paint: {
        "fill-color": gradientExpression((g) => `rgb(${g.color.join(", ")})`),
        "fill-opacity": gradientExpression((g) => g.opacity),
        "fill-antialias": false,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "fire-outline",
      type: "line",
      source: SOURCE_OUTLINE,
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: {
        "line-color": FIRE_RED,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 5, 2, 10, 2.5],
      },
    },
    beforeId,
  );
}

// `max` sets the top of the intensity scale. It defaults to the largest cell in this answer; the
// time-lapse passes one fixed value for the whole range so months compare fairly.
export function setFireData(map: MapLibreMap, grid: GridResponse | undefined, max?: number): void {
  const cells = map.getSource<GeoJSONSource>(SOURCE_CELLS);
  const outline = map.getSource<GeoJSONSource>(SOURCE_OUTLINE);
  if (!cells || !outline) return;
  cells.setData(grid ? cellsWithIntensity(grid, max ?? grid.max) : EMPTY);
  outline.setData(grid ? cellOutline(grid.cells, grid.step) : EMPTY);
}
