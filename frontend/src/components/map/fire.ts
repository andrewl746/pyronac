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

// Two copies of the fire layers, A and B. A new answer goes into the hidden copy, which then fades in
// while the shown copy fades out: a cross-fade, so the time-lapse and month changes do not jump.
const SLOTS = ["a", "b"] as const;
type Slot = (typeof SLOTS)[number];
const cellsSource = (slot: Slot) => `fire-cells-${slot}`;
const outlineSource = (slot: Slot) => `fire-outline-${slot}`;
const fillLayer = (slot: Slot) => `fire-fill-${slot}`;
const lineLayer = (slot: Slot) => `fire-line-${slot}`;
export const FIRE_FILL_LAYERS = SLOTS.map(fillLayer);
export const FIRE_LAYER_IDS = [...FIRE_FILL_LAYERS, ...SLOTS.map(lineLayer)];

// How long a cross-fade takes. The time-lapse steps every 250 ms, so each month fades into the next.
export const FADE_MS = 220;

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

// Adds both copies of the cells and the outline, under `beforeId`. Copy A starts shown, B hidden.
// Each cell's own see-through-ness lives in its colour, so the layer's opacity is free to fade.
export function addFireLayers(map: MapLibreMap, beforeId: string): void {
  for (const slot of SLOTS) {
    const opacity = slot === "a" ? 1 : 0;
    map.addSource(cellsSource(slot), { type: "geojson", data: EMPTY });
    map.addSource(outlineSource(slot), { type: "geojson", data: EMPTY });
    map.addLayer(
      {
        id: fillLayer(slot),
        type: "fill",
        source: cellsSource(slot),
        paint: {
          "fill-color": gradientExpression((g) => `rgba(${g.color.join(", ")}, ${g.opacity})`),
          "fill-opacity": opacity,
          "fill-opacity-transition": { duration: FADE_MS, delay: 0 },
          "fill-antialias": false,
        },
      },
      beforeId,
    );
    map.addLayer(
      {
        id: lineLayer(slot),
        type: "line",
        source: outlineSource(slot),
        layout: { "line-cap": "square", "line-join": "miter" },
        paint: {
          "line-color": FIRE_RED,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 5, 2, 10, 2.5],
          "line-opacity": opacity,
          "line-opacity-transition": { duration: FADE_MS, delay: 0 },
        },
      },
      beforeId,
    );
  }
}

// Which copy is shown on each map, and a counter so a slow answer never fades in over a newer one.
const fades = new WeakMap<MapLibreMap, { shown: 0 | 1; version: number; clearTimer?: number }>();

function setSlotOpacity(map: MapLibreMap, slot: Slot, opacity: number, durationMs: number): void {
  map.setPaintProperty(fillLayer(slot), "fill-opacity-transition", { duration: durationMs, delay: 0 });
  map.setPaintProperty(fillLayer(slot), "fill-opacity", opacity);
  map.setPaintProperty(lineLayer(slot), "line-opacity-transition", { duration: durationMs, delay: 0 });
  map.setPaintProperty(lineLayer(slot), "line-opacity", opacity);
}

// Shows a new answer by cross-fading to it over `fadeMs` (0 swaps at once, for reduced motion).
// `max` sets the top of the intensity scale. It defaults to the largest cell in this answer; the
// time-lapse passes one fixed value for the whole range so months compare fairly.
export async function setFireData(
  map: MapLibreMap,
  grid: GridResponse | undefined,
  max?: number,
  fadeMs = FADE_MS,
): Promise<void> {
  let state = fades.get(map);
  if (!state) {
    state = { shown: 0, version: 0 };
    fades.set(map, state);
  }
  const version = ++state.version;
  window.clearTimeout(state.clearTimer);

  if (fadeMs <= 0) {
    // No fade (reduced motion): update the shown copy in place. Swapping copies without a fade could
    // flash an empty frame before the new copy's tiles are drawn.
    const shown = SLOTS[state.shown];
    const hidden = SLOTS[1 - state.shown];
    try {
      setSlotOpacity(map, shown, 1, 0);
      setSlotOpacity(map, hidden, 0, 0);
      map.getSource<GeoJSONSource>(cellsSource(hidden))?.setData(EMPTY);
      map.getSource<GeoJSONSource>(outlineSource(hidden))?.setData(EMPTY);
      await Promise.all([
        map.getSource<GeoJSONSource>(cellsSource(shown))?.setData(grid ? cellsWithIntensity(grid, max ?? grid.max) : EMPTY),
        map.getSource<GeoJSONSource>(outlineSource(shown))?.setData(grid ? cellOutline(grid.cells, grid.step) : EMPTY),
      ]);
    } catch {
      // the map was removed while the data loaded
    }
    return;
  }

  const incoming = SLOTS[1 - state.shown];
  const outgoing = SLOTS[state.shown];
  const cells = map.getSource<GeoJSONSource>(cellsSource(incoming));
  const outline = map.getSource<GeoJSONSource>(outlineSource(incoming));
  if (!cells || !outline) return;

  // The copy we write into may still be fading out from the step before: hide it at once.
  setSlotOpacity(map, incoming, 0, 0);
  try {
    await Promise.all([
      cells.setData(grid ? cellsWithIntensity(grid, max ?? grid.max) : EMPTY),
      outline.setData(grid ? cellOutline(grid.cells, grid.step) : EMPTY),
    ]);
    if (state.version !== version) return; // a newer answer arrived while this one loaded
    setSlotOpacity(map, incoming, 1, fadeMs);
    setSlotOpacity(map, outgoing, 0, fadeMs);
  } catch {
    return; // the map was removed while the data loaded
  }
  const shownNow = (1 - state.shown) as 0 | 1;
  state.shown = shownNow;
  // Once it has faded out, empty the old copy so its cells stop answering the mouse.
  state.clearTimer = window.setTimeout(() => {
    if (state.shown !== shownNow) return;
    map.getSource<GeoJSONSource>(cellsSource(outgoing))?.setData(EMPTY);
    map.getSource<GeoJSONSource>(outlineSource(outgoing))?.setData(EMPTY);
  }, fadeMs + 50);
}
