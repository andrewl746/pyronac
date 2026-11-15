// Shared pieces for drawing grid cells as soft light instead of squares: the centre point of each
// cell, and a size in pixels that follows the cell's size on screen at every zoom.
import type { Feature, FeatureCollection, Point } from "geojson";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

// Pixels per degree of longitude at the map centre, at zoom 0. On the globe MapLibre keeps the
// scale at the centre equal to the flat map's, so this holds at any latitude: 512 / 360.
const PX_PER_DEGREE_Z0 = 512 / 360;
const MAX_ZOOM = 22;

// A radius in pixels of `factor` cell widths for cells `step` tenths of a degree wide, doubling
// with each zoom level so the glow stays tied to the ground.
export function cellRadius(step: number, factor: number): ExpressionSpecification {
  const atZ0 = (step / 10) * PX_PER_DEGREE_Z0 * factor;
  return ["interpolate", ["exponential", 2], ["zoom"], 0, atZ0, MAX_ZOOM, atZ0 * 2 ** MAX_ZOOM];
}

// Circle layers drawn as glows: their cell size and spread, so their radius can follow the
// latitude at the middle of the view. Cells one degree of latitude apart sit 1 / cos(latitude)
// times further apart on screen than cells one degree of longitude apart, so the glow is sized by
// the latitude spacing and no rows of dots show.
const glows = new Map<string, { step: number; spread: number }>();
let viewCos = 1;

function applyGlow(map: MapLibreMap, layer: string): void {
  const glow = glows.get(layer);
  if (glow && map.getLayer(layer)) map.setPaintProperty(layer, "circle-radius", cellRadius(glow.step, glow.spread / viewCos));
}

export function setGlowStep(map: MapLibreMap, layer: string, step: number, spread: number): void {
  glows.set(layer, { step, spread });
  applyGlow(map, layer);
}

export function setGlowLatitude(map: MapLibreMap, latitude: number): void {
  viewCos = Math.max(0.3, Math.cos((latitude * Math.PI) / 180));
  for (const layer of glows.keys()) applyGlow(map, layer);
}

// The centre of each cell [x, y, ...] at `step`, carrying the given properties.
export function cellCentres<P>(
  cells: [number, number, ...unknown[]][],
  step: number,
  properties: (i: number) => P,
): FeatureCollection<Point, P> {
  const deg = step / 10;
  return {
    type: "FeatureCollection",
    features: cells.map(
      ([x, y], i): Feature<Point, P> => ({
        type: "Feature",
        properties: properties(i),
        geometry: { type: "Point", coordinates: [(x + 0.5) * deg, (y + 0.5) * deg] },
      }),
    ),
  };
}

// "#ff8800" or "rgb(255, 136, 0)" -> "rgba(255, 136, 0, a)", for colours MapLibre must fade.
export function withAlpha(color: string, alpha: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (color.startsWith("#")) {
    r = parseInt(color.slice(1, 3), 16);
    g = parseInt(color.slice(3, 5), 16);
    b = parseInt(color.slice(5, 7), 16);
  } else {
    const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
    [r, g, b] = parts;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
