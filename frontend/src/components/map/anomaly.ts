// Extra #3 in MASTERSPEC.md section 13: the anomaly map. Each cell is coloured by how unusual the
// chosen month is there, compared with the same month in every other complete year since 2003.
// Five classes on a diverging blue-to-orange scale, which stays readable with colour vision
// deficiency. The classes use the same thresholds and words as the label in /api/compare.
import type { FeatureCollection, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { AnomalyResponse, CompareLabel } from "../../api/types";
import { cellsToGeoJSON } from "../../lib/geo";
import { cellCentres, cellRadius, setGlowStep } from "./glow";

// `range` is the percentile range anomalyClass puts in each class, for the legend (section 8:
// every coloured thing has a legend with numbers on it).
export const ANOMALY_CLASSES: { label: CompareLabel; range: string; color: string; opacity: number }[] = [
  { label: "well below normal", range: "10th or lower", color: "#2f86ff", opacity: 1 },
  { label: "below normal", range: "10th to 25th", color: "#7cb8ff", opacity: 0.75 },
  { label: "near normal", range: "25th to 75th", color: "#9aa4b1", opacity: 0.16 },
  { label: "above normal", range: "75th to 90th", color: "#ffa23a", opacity: 0.8 },
  { label: "well above normal", range: "90th or higher", color: "#ff4d12", opacity: 1 },
];

const SOURCE = "anomaly-cells";
const SOURCE_POINTS = "anomaly-points";
export const ANOMALY_LAYER = "anomaly-fill"; // invisible squares, for hover only
const ANOMALY_GLOW = "anomaly-glow";
export const ANOMALY_LAYER_IDS = [ANOMALY_GLOW, ANOMALY_LAYER];

// The class index for a percentile: the same rule as `label` in /api/compare (section 7).
export function anomalyClass(percentile: number): number {
  if (percentile >= 90) return 4;
  if (percentile >= 75) return 3;
  if (percentile > 25) return 2;
  if (percentile > 10) return 1;
  return 0;
}

export type AnomalyCellProperties = { value: number; median: number; percentile: number; cls: number };

function anomalyFeatures(data: AnomalyResponse): FeatureCollection<Polygon, AnomalyCellProperties> {
  const squares = cellsToGeoJSON(
    data.cells.map(([x, y, value]) => [x, y, value]),
    data.step,
  );
  return {
    type: "FeatureCollection",
    features: squares.features.map((square, i) => {
      const [, , value, median, percentile] = data.cells[i];
      return { ...square, properties: { value, median, percentile, cls: anomalyClass(percentile) } };
    }),
  };
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// How far each cell's glow reaches, in cell heights. With circle-blur 1 the glow fades from the
// centre, so neighbours overlap into one soft field.
export const GLOW_SPREAD = 1.25;

// ["match", ["get", "cls"], 0, ..., 4, ..., fallback]: one value per class, falling back to "near normal".
function byClass(pick: (c: (typeof ANOMALY_CLASSES)[number]) => string | number): ExpressionSpecification {
  const [a, b, c, d, e] = ANOMALY_CLASSES.map(pick);
  return ["match", ["get", "cls"], 0, a, 1, b, 2, c, 3, d, 4, e, c];
}

// Adds the sources and the (hidden) layers, under `beforeId`. Each cell is a soft round glow in its
// class colour; invisible squares on top answer hover.
export function addAnomalyLayer(map: MapLibreMap, beforeId: string): void {
  map.addSource(SOURCE, { type: "geojson", data: EMPTY });
  map.addSource(SOURCE_POINTS, { type: "geojson", data: EMPTY });
  map.addLayer(
    {
      id: ANOMALY_GLOW,
      type: "circle",
      source: SOURCE_POINTS,
      layout: { visibility: "none" },
      paint: {
        "circle-color": byClass((c) => c.color),
        "circle-opacity": byClass((c) => c.opacity),
        "circle-radius": cellRadius(10, GLOW_SPREAD),
        "circle-blur": 0.8,
        "circle-pitch-alignment": "map",
        "circle-pitch-scale": "map",
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: ANOMALY_LAYER,
      type: "fill",
      source: SOURCE,
      layout: { visibility: "none" },
      paint: { "fill-color": "#000", "fill-opacity": 0 },
    },
    beforeId,
  );
}

export function setAnomalyData(map: MapLibreMap, data: AnomalyResponse | undefined): void {
  map.getSource<GeoJSONSource>(SOURCE)?.setData(data ? anomalyFeatures(data) : EMPTY);
  map
    .getSource<GeoJSONSource>(SOURCE_POINTS)
    ?.setData(data ? cellCentres(data.cells, data.step, (i) => ({ cls: anomalyClass(data.cells[i][4]) })) : EMPTY);
  if (data) setGlowStep(map, ANOMALY_GLOW, data.step, GLOW_SPREAD);
}

// "above normal" -> "Above normal"
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// 87 -> "87th", 1 -> "1st", 12 -> "12th"
export function ordinal(n: number): string {
  const r = Math.round(n);
  const teen = r % 100 >= 11 && r % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][r % 10] ?? "th");
  return `${r}${suffix}`;
}
