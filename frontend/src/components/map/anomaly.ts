// Extra #3 in MASTERSPEC.md section 13: the anomaly map. Each cell is coloured by how unusual the
// chosen month is there, compared with the same month in every other complete year since 2003.
// Five classes on a diverging blue-to-orange scale, which stays readable with colour vision
// deficiency. The classes use the same thresholds and words as the label in /api/compare.
import type { FeatureCollection, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { AnomalyResponse, CompareLabel } from "../../api/types";
import { cellsToGeoJSON } from "../../lib/geo";

export const ANOMALY_CLASSES: { label: CompareLabel; color: string; opacity: number }[] = [
  { label: "well below normal", color: "#2f6db5", opacity: 0.85 },
  { label: "below normal", color: "#8db6e0", opacity: 0.75 },
  { label: "near normal", color: "#e9e5dc", opacity: 0.4 },
  { label: "above normal", color: "#f6a04d", opacity: 0.75 },
  { label: "well above normal", color: "#e0590b", opacity: 0.85 },
];

const SOURCE = "anomaly-cells";
export const ANOMALY_LAYER = "anomaly-fill";

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

// ["match", ["get", "cls"], 0, ..., 4, ..., fallback]: one value per class, falling back to "near normal".
function byClass(pick: (c: (typeof ANOMALY_CLASSES)[number]) => string | number): ExpressionSpecification {
  const [a, b, c, d, e] = ANOMALY_CLASSES.map(pick);
  return ["match", ["get", "cls"], 0, a, 1, b, 2, c, 3, d, 4, e, c];
}

// Adds the source and the (hidden) layer, under `beforeId`.
export function addAnomalyLayer(map: MapLibreMap, beforeId: string): void {
  map.addSource(SOURCE, { type: "geojson", data: EMPTY });
  map.addLayer(
    {
      id: ANOMALY_LAYER,
      type: "fill",
      source: SOURCE,
      layout: { visibility: "none" },
      paint: {
        "fill-color": byClass((c) => c.color),
        "fill-opacity": byClass((c) => c.opacity),
        // A faint dark edge so neighbouring cells of the same class still read as cells.
        "fill-outline-color": "rgba(0, 0, 0, 0.35)",
      },
    },
    beforeId,
  );
}

export function setAnomalyData(map: MapLibreMap, data: AnomalyResponse | undefined): void {
  map.getSource<GeoJSONSource>(SOURCE)?.setData(data ? anomalyFeatures(data) : EMPTY);
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
