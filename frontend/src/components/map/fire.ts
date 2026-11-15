// How fire shows on the map: each cell is filled from the colour ramp in lib/colors.ts (Fire or
// Cividis, the header switch), on the log scale of scaleValue. Opacity rises with the count too, so
// cells with few hot spots are faint and the busiest ones glow, like lights on the night side of
// Earth. Cells are drawn as a continuous glow (a heatmap of the cell centres) so no squares show;
// invisible squares on top answer hover with the exact count.
import type { FeatureCollection, Point, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { GridResponse } from "../../api/types";
import { rampColor, scaleValue } from "../../lib/colors";
import { cellsToGeoJSON, type CellProperties } from "../../lib/geo";
import type { Ramp } from "../../state/store";
import { cellCentres, cellRadius, withAlpha } from "./glow";

// Opacity from t = 0 (fewest hot spots) to t = 1 (most). Lightness carries the scale as well,
// so it reads without hue.
const OPACITY: [number, number][] = [
  [0, 0.12],
  [0.4, 0.38],
  [0.75, 0.8],
  [1, 1],
];
// Where t = 0 starts on the ramp. On Fire (inferno) this skips the purples, so the faintest cells
// are a deep ember red and the hottest a near-white yellow. Cividis uses its whole range, which
// keeps it distinguishable for colour vision deficiency.
const RAMP_FLOOR: Record<Ramp, number> = { fire: 0.32, cividis: 0 };
// Cores burn a little past the top of the scale, so the busiest places glow white-yellow.
const CORE_BOOST = 1.05;
// Colour climbs the ramp slowly at first, so most of a burning area is deep red-orange and only
// the busiest cells reach yellow and white.
const COLOR_CURVE = 1.6;
const RAMP_STEPS = 10;
// The glow of one cell reaches this many cell heights from its centre, so neighbours blend.
const SPREAD = 2;
// MapLibre's heatmap kernel is 0.3989 * exp(-4.5 * (d / radius)^2) per unit weight. On the globe,
// cells are one cell height apart and cos(latitude) of that apart across, so the kernels sum to
// about KERNEL_SUM / cos(latitude). Each cell's weight is t * cos(latitude) and the intensity is
// 1 / KERNEL_SUM, so the density inside a burning area is close to t at any latitude.
// The bloom reaches this many times further than the glow.
const HALO = 3;
const KERNEL_SUM = 0.3989422804 * ((2 * Math.PI) / 9) * SPREAD * SPREAD;

// The opacity at intensity t: the same curve for the map, its legend and the fire calendar.
export function fireOpacity(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const i = Math.max(1, OPACITY.findIndex(([s]) => s >= c));
  const [t0, o0] = OPACITY[i - 1];
  const [t1, o1] = OPACITY[i];
  return o0 + ((c - t0) / (t1 - t0)) * (o1 - o0);
}

const SOURCE_CELLS = "fire-cells";
const SOURCE_POINTS = "fire-points";
export const LAYER_FILL = "fire-fill"; // invisible squares, for hover only
const LAYER_HEAT = "fire-heat";
const LAYER_HALO = "fire-halo"; // a wide, faint bloom under the glow
export const FIRE_LAYER_IDS = [LAYER_HALO, LAYER_HEAT, LAYER_FILL];

// Counts are very uneven, so intensity follows scaleValue (a log scale) from lib/colors.ts.
// The count at a given intensity: the inverse of scaleValue, for the legend.
export function valueAt(t: number, max: number): number {
  return Math.expm1(t * Math.log1p(max));
}

// The colour at intensity t, before opacity: a part of the ramp from lib/colors.ts.
export function fireColor(t: number, ramp: Ramp): string {
  const floor = RAMP_FLOOR[ramp];
  return rampColor(floor + (1 - floor) * Math.min(1, Math.max(0, t)) ** COLOR_CURVE, ramp);
}

// The colour at intensity t as a CSS colour, the same as the map draws it, for the legend.
export function fireFill(t: number, ramp: Ramp): string {
  return withAlpha(fireColor(t, ramp), fireOpacity(t));
}

// The heatmap's density is close to t inside a burning area (see setFireLatitude) and falls to 0
// at its edges, so it is coloured with the ramp directly and fades out to nothing.
function heatColor(ramp: Ramp, alpha = 1): ExpressionSpecification {
  const at = (t: number) => withAlpha(fireColor(t, ramp), fireOpacity(t) * alpha);
  const stops: (number | string)[] = [0, "rgba(0, 0, 0, 0)", 0.03, at(0.03)];
  for (let i = 1; i < RAMP_STEPS; i++) {
    const t = i / (RAMP_STEPS - 1);
    stops.push(t, at(t));
  }
  return ["interpolate", ["linear"], ["heatmap-density"], ...stops] as ExpressionSpecification;
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

function pointsWithIntensity(grid: GridResponse, max: number): FeatureCollection<Point, { t: number; w: number }> {
  return cellCentres(grid.cells, grid.step, (i) => {
    const [, y, value] = grid.cells[i];
    const latitude = ((y + 0.5) * grid.step) / 10;
    const t = scaleValue(value, max);
    return { t, w: t * Math.max(0.05, Math.cos((latitude * Math.PI) / 180)) };
  });
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// Adds the sources and the layers, under `beforeId`.
export function addFireLayers(map: MapLibreMap, beforeId: string, ramp: Ramp): void {
  map.addSource(SOURCE_CELLS, { type: "geojson", data: EMPTY });
  map.addSource(SOURCE_POINTS, { type: "geojson", data: EMPTY });

  map.addLayer(
    {
      id: LAYER_HALO,
      type: "heatmap",
      source: SOURCE_POINTS,
      paint: {
        "heatmap-weight": ["get", "w"],
        "heatmap-radius": cellRadius(10, SPREAD * HALO),
        "heatmap-intensity": 1 / (KERNEL_SUM * HALO * HALO),
        "heatmap-color": heatColor(ramp, 0.35),
        "heatmap-opacity": 1,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: LAYER_HEAT,
      type: "heatmap",
      source: SOURCE_POINTS,
      paint: {
        "heatmap-weight": ["get", "w"],
        "heatmap-radius": cellRadius(10, SPREAD),
        "heatmap-intensity": CORE_BOOST / KERNEL_SUM,
        "heatmap-color": heatColor(ramp),
        "heatmap-opacity": 1,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: LAYER_FILL,
      type: "fill",
      source: SOURCE_CELLS,
      paint: { "fill-color": "#000", "fill-opacity": 0 },
    },
    beforeId,
  );
}

// Recolours the glow when the ramp switch changes.
export function setFireRamp(map: MapLibreMap, ramp: Ramp): void {
  if (map.getLayer(LAYER_HEAT)) map.setPaintProperty(LAYER_HEAT, "heatmap-color", heatColor(ramp));
  if (map.getLayer(LAYER_HALO)) map.setPaintProperty(LAYER_HALO, "heatmap-color", heatColor(ramp, 0.35));
}

// The globe's radius follows the latitude at the middle of the view, and the glow is sized by the
// spacing of the rows (one cell height), so it is set again whenever the view moves.
let fireStep = 10;
let fireCos = 1;

function applyFireScale(map: MapLibreMap): void {
  if (map.getLayer(LAYER_HEAT)) map.setPaintProperty(LAYER_HEAT, "heatmap-radius", cellRadius(fireStep, SPREAD / fireCos));
  if (map.getLayer(LAYER_HALO)) map.setPaintProperty(LAYER_HALO, "heatmap-radius", cellRadius(fireStep, (SPREAD * HALO) / fireCos));
}

export function setFireLatitude(map: MapLibreMap, latitude: number): void {
  fireCos = Math.max(0.3, Math.cos((latitude * Math.PI) / 180));
  applyFireScale(map);
}

// `max` sets the top of the intensity scale. It defaults to the largest cell in this answer; the
// time-lapse passes one fixed value for the whole range so months compare fairly.
export function setFireData(map: MapLibreMap, grid: GridResponse | undefined, max?: number): void {
  const cells = map.getSource<GeoJSONSource>(SOURCE_CELLS);
  const points = map.getSource<GeoJSONSource>(SOURCE_POINTS);
  if (!cells || !points) return;
  const top = grid ? (max ?? grid.max) : 0;
  cells.setData(grid ? cellsWithIntensity(grid, top) : EMPTY);
  points.setData(grid ? pointsWithIntensity(grid, top) : EMPTY);
  if (grid) {
    fireStep = grid.step;
    applyFireScale(map);
  }
}
