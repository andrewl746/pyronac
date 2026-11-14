// The trend view: each cell is coloured by how its yearly hot spot count has changed over the full
// years of the year range. Counts are harmonized, so the 2012 change of sensor cannot fake a rise.
// Higher trend, darker colour: five classes from pale yellow (falling or flat) to dark red (rising most).
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMemo } from "react";
import { api } from "../../api/client";
import { gridKey, useMeta, useTrend } from "../../api/hooks";
import type { GridResponse } from "../../api/types";
import { cellsToGeoJSON, WORLD, WORLD_STEP } from "../../lib/geo";
import { useStore } from "../../state/store";
import { lastFullYear, trendYears } from "../trend/sentences";
import { parseYearMonth } from "./labels";
import { cellTrends, trendBreaks, trendClass, type CellTrend } from "./trendMath";

export { signedCount } from "./trendMath";

// Yellow-orange-red, light to dark. Each step is darker than the last, so it reads without hue too.
export const TREND_COLORS = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"];
export const TREND_LAYER = "trend-fill";
const SOURCE = "trend-cells";

// The full years of the year range: January to December both within the data.
function fullYearsOf(firstMonth: string, lastFull: number, startYear: number, endYear: number): number[] {
  const first = parseYearMonth(firstMonth);
  if (!first) return [];
  const from = Math.max(startYear, first.month === 1 ? first.year : first.year + 1);
  const to = Math.min(endYear, lastFull);
  const years: number[] = [];
  for (let y = from; y <= to; y++) years.push(y);
  return years;
}

function combineYears(results: UseQueryResult<GridResponse, Error>[]) {
  const grids = results.map((r) => r.data).filter((g): g is GridResponse => g !== undefined);
  return {
    grids: results.length > 0 && grids.length === results.length ? grids : null,
    done: grids.length,
    total: results.length,
    error: results.find((r) => r.error)?.error ?? null,
  };
}

// `active` is true in the trend view. It loads one /api/grid answer per full year, through useGrid's
// own query key, and fits a trend per cell. With a box it also asks /api/trend for the whole box.
export function useTrendMap(active: boolean) {
  const meta = useMeta();
  const bbox = useStore((s) => s.bbox);
  const startYear = useStore((s) => s.startYear);
  const endYear = useStore((s) => s.endYear);

  const firstMonth = meta.data?.first_month ?? "";
  const lastFull = meta.data ? lastFullYear(meta.data) : 0;
  const years = useMemo(
    () => fullYearsOf(firstMonth, lastFull, startYear, endYear),
    [firstMonth, lastFull, startYear, endYear],
  );
  const enough = years.length >= 3;
  const box = bbox ?? WORLD;
  const step = bbox ? undefined : WORLD_STEP;

  const loaded = useQueries({
    queries: years.map((y) => ({
      queryKey: gridKey(box, `${y}-01`, `${y}-12`, step),
      queryFn: () => api.grid(box, `${y}-01`, `${y}-12`, step),
      enabled: active && enough,
      staleTime: Infinity,
    })),
    combine: combineYears,
  });

  const trends = useMemo(
    () => (loaded.grids && enough ? cellTrends(loaded.grids, years) : null),
    [loaded.grids, years, enough],
  );
  const breaks = useMemo(() => (trends ? trendBreaks(trends.map((t) => t.slope)) : []), [trends]);
  const cellStep = loaded.grids?.[0]?.step;

  // The whole box, harmonized against raw: the same request the trend chart used to make.
  const boxYears = meta.data ? trendYears(meta.data, startYear, endYear) : null;
  const boxTrend = useTrend(active && boxYears ? bbox : null, boxYears?.[0], boxYears?.[1]);

  return {
    years,
    enough,
    done: loaded.done,
    total: loaded.total,
    error: loaded.error,
    trends,
    breaks,
    step: cellStep,
    boxTrend: boxTrend.data,
  };
}

export type TrendMap = ReturnType<typeof useTrendMap>;

function byClass(): ExpressionSpecification {
  const [c0, c1, c2, c3, c4] = TREND_COLORS;
  return ["match", ["get", "cls"], 0, c0, 1, c1, 2, c2, 3, c3, 4, c4, c2];
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// Adds the source and the (hidden) layer, under `beforeId`.
export function addTrendLayer(map: MapLibreMap, beforeId: string): void {
  map.addSource(SOURCE, { type: "geojson", data: EMPTY });
  map.addLayer(
    {
      id: TREND_LAYER,
      type: "fill",
      source: SOURCE,
      layout: { visibility: "none" },
      paint: {
        "fill-color": byClass(),
        "fill-opacity": 0.8,
        // A faint dark edge so neighbouring cells of the same colour still read as cells.
        "fill-outline-color": "rgba(0, 0, 0, 0.3)",
      },
    },
    beforeId,
  );
}

export function setTrendData(
  map: MapLibreMap,
  trends: CellTrend[] | null,
  step: number | undefined,
  breaks: number[],
): void {
  const source = map.getSource<GeoJSONSource>(SOURCE);
  if (!source) return;
  if (!trends || step === undefined) {
    source.setData(EMPTY);
    return;
  }
  const squares = cellsToGeoJSON(
    trends.map((t) => [t.x, t.y, t.slope]),
    step,
  );
  source.setData({
    type: "FeatureCollection",
    features: squares.features.map((square, i) => ({
      ...square,
      properties: { slope: trends[i].slope, mean: trends[i].mean, cls: trendClass(trends[i].slope, breaks) },
    })),
  });
}
