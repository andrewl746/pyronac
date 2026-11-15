import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnomaly, useGrid, useMeta } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { snapBbox, WORLD, WORLD_STEP } from "../../lib/geo";
import { useStore } from "../../state/store";
import { useBaseLayer } from "../bases/layer";
import { BASEMAP, FIRST_LABEL_LAYER } from "./basemap";
import { formatCount, formatMonthYear } from "../../lib/format";
import { addAnomalyLayer, ANOMALY_CLASSES, ANOMALY_LAYER, ordinal, sentenceCase, setAnomalyData } from "./anomaly";
import AnomalyLegend from "./AnomalyLegend";
import { addFireLayers, FIRE_LAYER_IDS, LAYER_FILL, setFireData } from "./fire";
import { mapPeriod, parseYearMonth, ym } from "./labels";
import Legend from "./Legend";
import MonthPicker from "./MonthPicker";
import "./map.css";
import { addSelectionLayers, setSelectedBox, useDrawBox } from "./selection";
import { useTimeLapse } from "./timeLapse";
import TimeLapseBar from "./TimeLapseBar";
import { addTrendLayer, setTrendData, signedCount, TREND_LAYER, useTrendMap } from "./trend";
import TrendLegend from "./TrendLegend";

// After bundling, MapLibre looks for its worker next to the bundle, where it is not (issue #22).
// Importing it with ?url makes Vite copy it into dist/assets; this points MapLibre at that copy.
maplibregl.setWorkerUrl(workerUrl);

// The opening view from MASTERSPEC.md section 8: the globe, centred over Canada.
const START = { center: [-100, 55] as [number, number], zoom: 1.8 };

// "fire" shows the hot spots (red gradient). "anomaly" shows how unusual one month is (extra #3).
// "trend" shows how each cell's yearly count has changed over the full years of the range.
type View = "fire" | "anomaly" | "trend";

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// MapLibre needs WebGL. Checked once, so a browser without it gets a message instead of a crash.
function webglAvailable(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [mapFailed] = useState(() => !webglAvailable());

  const bbox = useStore((s) => s.bbox);
  const setBbox = useStore((s) => s.setBbox);
  const startYear = useStore((s) => s.startYear);
  const endYear = useStore((s) => s.endYear);
  const selected = useStore((s) => s.selected);
  const period = mapPeriod(selected, startYear, endYear);
  const grid = useGrid(bbox ?? WORLD, period.start, period.end, bbox ? undefined : WORLD_STEP);

  // The anomaly view compares one month: the one picked in the calendar, otherwise the latest
  // complete month, as the compare panel does. It needs a box, like every hook but useGrid.
  const [view, setView] = useState<View>("fire");
  const anomalyOn = view === "anomaly";
  const trendOn = view === "trend";
  const fireOn = view === "fire";
  // The time-lapse (extra #9) plays in the hot spots view and fixes the scale across its months.
  const timeLapse = useTimeLapse(fireOn);
  // The trend view loads one grid per full year and fits a trend per cell.
  const trendMap = useTrendMap(trendOn);
  const trendYearsLabel = trendMap.enough
    ? `${trendMap.years[0]} to ${trendMap.years[trendMap.years.length - 1]}`
    : "";
  const scaleMax = timeLapse.scaleMax;
  const firstShown = timeLapse.months[0];
  const lastShown = timeLapse.months[timeLapse.months.length - 1];
  const scaleNote =
    scaleMax !== null && firstShown && lastShown
      ? `Scale fixed across ${formatMonthYear(firstShown.year, firstShown.month)} to ${formatMonthYear(lastShown.year, lastShown.month)}, so months compare fairly.`
      : undefined;
  const meta = useMeta();
  const anomalyMonth = selected ?? parseYearMonth(meta.data?.last_complete_month);
  const anomalyLabel = anomalyMonth ? formatMonthYear(anomalyMonth.year, anomalyMonth.month) : null;
  const anomalyPartial =
    !!anomalyMonth &&
    !!meta.data &&
    meta.data.last_month !== meta.data.last_complete_month &&
    ym(anomalyMonth.year, anomalyMonth.month) === meta.data.last_month;
  const anomaly = useAnomaly(
    anomalyOn && anomalyMonth ? bbox : null,
    anomalyMonth?.year ?? 0,
    anomalyMonth?.month ?? 0,
  );

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = new maplibregl.Map({
      container,
      style: BASEMAP,
      center: START.center,
      zoom: START.zoom,
      minZoom: 0.5,
      maxZoom: 16,
      attributionControl: { compact: true },
    });
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    instance.on("style.load", () => {
      instance.setProjection({ type: "globe" });
      addFireLayers(instance, FIRST_LABEL_LAYER);
      addAnomalyLayer(instance, FIRST_LABEL_LAYER);
      addTrendLayer(instance, FIRST_LABEL_LAYER);
      addSelectionLayers(instance, FIRST_LABEL_LAYER);
      setMap(instance);
    });
    // Fold the attribution into its (i) button once the sources have added their credits,
    // so it does not run under the legend.
    instance.once("idle", () => {
      const attribution = container.querySelector(".maplibregl-ctrl-attrib");
      attribution?.classList.remove("maplibregl-compact-show");
      attribution?.removeAttribute("open");
    });
    return () => {
      setMap(null);
      instance.remove();
    };
  }, []);

  // The base planner's markers and reach circles (components/bases). Adds nothing until switched on.
  useBaseLayer(map);

  // Draw the fire cells whenever new grid data arrives.
  useEffect(() => {
    if (map) setFireData(map, grid.data, scaleMax ?? undefined);
  }, [map, grid.data, scaleMax]);

  // Draw the anomaly cells. With no box there is nothing to compare, so the layer is emptied.
  useEffect(() => {
    if (map) setAnomalyData(map, bbox ? anomaly.data : undefined);
  }, [map, bbox, anomaly.data]);

  // Draw the trend cells once every year has arrived.
  useEffect(() => {
    if (map) setTrendData(map, trendMap.trends, trendMap.step, trendMap.breaks);
  }, [map, trendMap.trends, trendMap.step, trendMap.breaks]);

  // Show one view at a time.
  useEffect(() => {
    if (!map) return;
    const visible = (on: boolean) => (on ? "visible" : "none");
    for (const id of FIRE_LAYER_IDS) map.setLayoutProperty(id, "visibility", visible(view === "fire"));
    map.setLayoutProperty(ANOMALY_LAYER, "visibility", visible(view === "anomaly"));
    map.setLayoutProperty(TREND_LAYER, "visibility", visible(view === "trend"));
  }, [map, view]);

  // Outline the selected box and fit the map to it. Clearing the box goes back to the globe.
  const hadBox = useRef(false);
  useEffect(() => {
    if (!map) return;
    setSelectedBox(map, bbox);
    const animate = !reducedMotion();
    if (bbox) {
      map.fitBounds(
        [
          [bbox.west, bbox.south],
          [bbox.east, bbox.north],
        ],
        // Extra room at the bottom keeps the box clear of the time-lapse bar.
        { padding: { top: 64, right: 64, bottom: 110, left: 64 }, maxZoom: 10, animate, duration: 1400 },
      );
    } else if (hadBox.current) {
      map.flyTo({ center: START.center, zoom: START.zoom, animate, duration: 1400 });
    }
    hadBox.current = bbox !== null;
  }, [map, bbox]);

  // Draw area: the drawn box is snapped, then goes to the store like every other box.
  const finishDrawing = useCallback(
    (box: Bbox) => {
      setDrawing(false);
      setBbox(snapBbox(box));
    },
    [setBbox],
  );
  const cancelDrawing = useCallback(() => setDrawing(false), []);
  const drawProblem = useDrawBox(map, drawing, finishDrawing, cancelDrawing);

  // Hovering a cell shows its exact numbers. Hidden layers get no mouse events, so only the
  // current view answers.
  const periodLabel = period.label;
  useEffect(() => {
    if (!map || drawing) return;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "pyronac-popup",
    });
    const move = map.on("mousemove", LAYER_FILL, (e) => {
      const value: unknown = e.features?.[0]?.properties?.value;
      if (typeof value !== "number") return;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${formatCount(value)}</strong> hot spot${value === 1 ? "" : "s"}<br><span>${periodLabel}</span>`,
        )
        .addTo(map);
    });
    const leave = map.on("mouseleave", LAYER_FILL, () => popup.remove());
    const anomalyMove = map.on("mousemove", ANOMALY_LAYER, (e) => {
      const properties = e.features?.[0]?.properties;
      const value: unknown = properties?.value;
      const median: unknown = properties?.median;
      const percentile: unknown = properties?.percentile;
      const cls: unknown = properties?.cls;
      if (typeof value !== "number" || typeof median !== "number") return;
      if (typeof percentile !== "number" || typeof cls !== "number") return;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${sentenceCase(ANOMALY_CLASSES[cls]?.label ?? "")}</strong><br>` +
            `${formatCount(value)} hot spot${value === 1 ? "" : "s"} in ${anomalyLabel ?? "this month"}<br>` +
            `<span>usually ${formatCount(median)} (median) · ${ordinal(percentile)} percentile</span>`,
        )
        .addTo(map);
    });
    const anomalyLeave = map.on("mouseleave", ANOMALY_LAYER, () => popup.remove());
    const trendMove = map.on("mousemove", TREND_LAYER, (e) => {
      const properties = e.features?.[0]?.properties;
      const slope: unknown = properties?.slope;
      const mean: unknown = properties?.mean;
      if (typeof slope !== "number" || typeof mean !== "number") return;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${signedCount(slope)} hot spots a year</strong>, each year<br>` +
            `${trendYearsLabel}, harmonized<br>` +
            `<span>about ${formatCount(Math.round(mean * 10) / 10)} a year on average</span>`,
        )
        .addTo(map);
    });
    const trendLeave = map.on("mouseleave", TREND_LAYER, () => popup.remove());
    return () => {
      move.unsubscribe();
      leave.unsubscribe();
      anomalyMove.unsubscribe();
      anomalyLeave.unsubscribe();
      trendMove.unsubscribe();
      trendLeave.unsubscribe();
      popup.remove();
    };
  }, [map, periodLabel, anomalyLabel, trendYearsLabel, drawing]);

  const active = anomalyOn ? anomaly : grid;

  function showWholeGlobe() {
    map?.flyTo({ center: START.center, zoom: START.zoom, animate: !reducedMotion(), duration: 1400 });
  }

  if (mapFailed) {
    return (
      <div role="alert" className="flex h-full items-center justify-center p-8 text-center text-[var(--text-dim)]">
        The map could not start because this browser has WebGL turned off or unavailable. The sidebar still works.
      </div>
    );
  }

  return (
    <>
      {/* The map tools come first so Tab reaches them before the map itself. */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          aria-pressed={drawing}
          disabled={!map}
          onClick={() => setDrawing((d) => !d)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium shadow-lg transition-colors disabled:opacity-50 ${
            drawing
              ? "border-[var(--accent)] bg-[var(--accent)] text-black"
              : "border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--panel-2)]"
          }`}
        >
          {drawing ? "Cancel drawing" : "Draw area"}
        </button>
        {!drawing && (
          <button
            type="button"
            disabled={!map}
            onClick={showWholeGlobe}
            className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--text)] shadow-lg hover:bg-[var(--panel-2)] disabled:opacity-50"
          >
            Whole globe
          </button>
        )}
        {!drawing && (
          <div
            role="group"
            aria-label="Map view"
            className="flex overflow-hidden rounded-md border border-[var(--border)] shadow-lg"
          >
            {(["fire", "anomaly", "trend"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`border-b-2 px-3 py-1.5 text-sm transition-colors ${
                  view === v
                    ? "border-[var(--accent)] bg-[var(--panel-2)] font-medium text-[var(--text)]"
                    : "border-transparent bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)]"
                }`}
              >
                {v === "fire" ? "Hot spots" : v === "anomaly" ? "Anomaly" : "Trend"}
              </button>
            ))}
          </div>
        )}
        {drawing && (
          <span
            role="status"
            className={`rounded-md bg-[var(--panel)]/90 px-2 py-1 text-xs ${drawProblem ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`}
          >
            {drawProblem ?? "Press, drag and release on the map. Esc cancels."}
          </span>
        )}
      </div>
      <div ref={containerRef} className="pyronac-map" />
      {/* Below the toolbar so a long message never covers the buttons. */}
      <div className="pointer-events-none absolute top-14 left-1/2 z-10 -translate-x-1/2">
        {trendOn ? (
          trendMap.error ? (
            <div role="alert" className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--text)] shadow-lg">
              Could not load the trend: {trendMap.error.message}
            </div>
          ) : (
            trendMap.enough &&
            !trendMap.trends && (
              <div role="status" className="rounded-md bg-[var(--panel)]/90 px-3 py-1.5 text-xs text-[var(--text-dim)] shadow-lg">
                Loading the trend: {trendMap.done} of {trendMap.total} years…
              </div>
            )
          )
        ) : anomalyOn && !bbox ? (
          <div role="status" className="rounded-md bg-[var(--panel)]/90 px-3 py-1.5 text-xs text-[var(--text-dim)] shadow-lg">
            Pick an area to see how unusual {anomalyLabel ?? "the month"} was there.
          </div>
        ) : active.isError ? (
          <div
            role="alert"
            className="pointer-events-auto flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--text)] shadow-lg"
          >
            <span>
              Could not load {anomalyOn ? "the anomaly map" : "hot spots"}: {active.error?.message}
            </span>
            <button
              type="button"
              onClick={() => void active.refetch()}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--panel-2)]"
            >
              Try again
            </button>
          </div>
        ) : (
          (active.isFetching || !map) && (
            <div
              role="status"
              className="rounded-md bg-[var(--panel)]/90 px-3 py-1.5 text-xs text-[var(--text-dim)] shadow-lg"
            >
              {!map ? "Loading the globe…" : anomalyOn ? "Loading the anomaly map…" : "Loading hot spots…"}
            </div>
          )
        )}
      </div>
      {trendOn ? (
        <TrendLegend trendMap={trendMap} hasBox={bbox !== null} />
      ) : anomalyOn ? (
        <AnomalyLegend
          monthLabel={anomalyLabel}
          partial={anomalyPartial}
          hasBox={bbox !== null}
          loading={anomaly.isFetching}
          failed={anomaly.isError}
        />
      ) : (
        <Legend
          max={scaleMax ?? grid.data?.max ?? 0}
          step={grid.data?.step ?? WORLD_STEP}
          period={period.label}
          loading={grid.isPending}
          failed={grid.isError}
          note={scaleNote}
        >
          <MonthPicker />
        </Legend>
      )}
      <TimeLapseBar timeLapse={timeLapse} enabled={fireOn} />
    </>
  );
}
