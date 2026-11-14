// How fire shows on the map: each connected burning area gets one red border, and inside it a
// red cross-hatch. More hot spots make the hatch denser and more opaque, with a stronger red tint.
// This replaces the colour-ramp fill in MASTERSPEC.md section 8, by Vlad's choice.
import type { FeatureCollection, MultiLineString, Polygon } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { GridResponse } from "../../api/types";
import { scaleValue } from "../../lib/colors";
import { cellsToGeoJSON, type CellProperties } from "../../lib/geo";

export const FIRE_RED = "#ff3131";

// The pattern tile is 32 CSS pixels: MapLibre needs a power of two for the pattern to repeat
// without seams. Three hatch densities, from a few hot spots to the most in view.
const TILE = 32;
export const HATCH_LEVELS = [
  { id: "fire-hatch-1", lines: 2, width: 1.5 },
  { id: "fire-hatch-2", lines: 3, width: 1.75 },
  { id: "fire-hatch-3", lines: 5, width: 2 },
] as const;

const SOURCE_CELLS = "fire-cells";
const SOURCE_OUTLINE = "fire-outline";
export const LAYER_FILL = "fire-hatch";
export const FIRE_LAYER_IDS = ["fire-tint", LAYER_FILL, "fire-outline"];

// Counts are very uneven, so intensity follows scaleValue (a log scale) from lib/colors.ts.
// The count at a given intensity: the inverse of scaleValue, for the legend.
export function valueAt(t: number, max: number): number {
  return Math.expm1(t * Math.log1p(max));
}

export function levelOf(t: number): number {
  return t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
}
export function hatchOpacity(t: number): number {
  return 0.45 + 0.55 * t;
}
export function tintOpacity(t: number): number {
  return 0.06 + 0.24 * t;
}

// One tile of red cross-hatch on a transparent background, at the screen's pixel ratio.
export function hatchCanvas(level: number, pixelRatio: number): HTMLCanvasElement {
  const { lines, width } = HATCH_LEVELS[level];
  const size = TILE * pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.strokeStyle = FIRE_RED;
  ctx.lineWidth = width * pixelRatio;
  const gap = size / lines;
  ctx.beginPath();
  // Lines y = x + o and y = -x + o, drawn past the edges so they wrap cleanly into the next tile.
  for (let k = -2 * lines; k <= 3 * lines; k++) {
    const o = k * gap;
    ctx.moveTo(-size, -size + o);
    ctx.lineTo(2 * size, 2 * size + o);
    ctx.moveTo(-size, size + o);
    ctx.lineTo(2 * size, -2 * size + o);
  }
  ctx.stroke();
  return canvas;
}

export function hatchCssBackground(level: number, pixelRatio: number): string {
  return `url(${hatchCanvas(level, pixelRatio).toDataURL()})`;
}

export const HATCH_TILE_CSS = `${TILE}px ${TILE}px`;

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

// Adds the pattern images, the two sources and the three layers, under `beforeId`.
export function addFireLayers(map: MapLibreMap, beforeId: string): void {
  const pixelRatio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  HATCH_LEVELS.forEach((level, i) => {
    const canvas = hatchCanvas(i, pixelRatio);
    const ctx = canvas.getContext("2d");
    if (ctx && !map.hasImage(level.id)) {
      map.addImage(level.id, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio });
    }
  });

  map.addSource(SOURCE_CELLS, { type: "geojson", data: EMPTY });
  map.addSource(SOURCE_OUTLINE, { type: "geojson", data: EMPTY });

  map.addLayer(
    {
      id: "fire-tint",
      type: "fill",
      source: SOURCE_CELLS,
      paint: {
        "fill-color": FIRE_RED,
        "fill-opacity": ["+", tintOpacity(0), ["*", tintOpacity(1) - tintOpacity(0), ["get", "t"]]],
        "fill-antialias": false,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: LAYER_FILL,
      type: "fill",
      source: SOURCE_CELLS,
      paint: {
        "fill-pattern": [
          "step",
          ["get", "t"],
          HATCH_LEVELS[0].id,
          1 / 3,
          HATCH_LEVELS[1].id,
          2 / 3,
          HATCH_LEVELS[2].id,
        ],
        "fill-opacity": ["+", hatchOpacity(0), ["*", hatchOpacity(1) - hatchOpacity(0), ["get", "t"]]],
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
