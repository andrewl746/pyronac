import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnomaly, useGrid, useMeta } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { snapBbox, WORLD, WORLD_STEP } from "../../lib/geo";
import { canHover, fitPadding, popupAnchor } from "../../lib/layout";
import { useStore } from "../../state/store";
import { BasesTopButton } from "../bases/BasePanel";
import { baseMarkerAt, useBaseLayer } from "../bases/layer";
import { BASEMAP, FIRST_LABEL_LAYER } from "./basemap";
import { formatCount, formatMonthYear } from "../../lib/format";
import { addAnomalyLayer, ANOMALY_CLASSES, ANOMALY_LAYER, ANOMALY_LAYER_IDS, ordinal, sentenceCase, setAnomalyData } from "./anomaly";
import AnomalyLegend from "./AnomalyLegend";
import { addFireLayers, FIRE_LAYER_IDS, LAYER_FILL, setFireData, setFireLatitude, setFireRamp } from "./fire";
import GlobeRim from "./GlobeRim";
import { setGlowLatitude } from "./glow";
import { clearPadding, homeView, minZoom, NO_PADDING } from "./home";
import RegionPanel from "../region/RegionPanel";
import { mapPeriod, parseYearMonth, ym } from "./labels";
import Legend from "./Legend";
import MonthPicker from "./MonthPicker";
import "./map.css";
import { addSelectionLayers, setSelectedBox, useDrawBox } from "./selection";
import Starfield from "./Starfield";
import { useTimeLapse } from "./timeLapse";
import TimeLapseBar from "./TimeLapseBar";
import { addTrendLayer, setTrendData, signedCount, TREND_LAYER, TREND_LAYER_IDS, useTrendMap } from "./trend";
import TrendLegend from "./TrendLegend";

// After bundling, MapLibre looks for its worker next to the bundle, where it is not (issue #22).
// Importing it with ?url makes Vite copy it into dist/assets; this points MapLibre at that copy.
maplibregl.setWorkerUrl(workerUrl);

// "fire" shows the hot spots (colour ramp). "anomaly" shows how unusual one month is (extra #3).
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
  const ramp = useStore((s) => s.ramp);
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
    // The opening view: the whole globe, centred over Canada (home.ts).
    const instance = new maplibregl.Map({
      container,
      style: BASEMAP,
      ...homeView(),
      minZoom: minZoom(),
      maxZoom: 16,
      attributionControl: { compact: false },
    });
    // The credits wrap onto more lines in a narrow window. The panels along the bottom sit above
    // them (--credit in layout.css), so keep their height up to date.
    const credits = container.querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
    const creditsObserver = new ResizeObserver(() => {
      if (credits?.offsetHeight) document.documentElement.style.setProperty("--credit", `${credits.offsetHeight}px`);
    });
    if (credits) creditsObserver.observe(credits);
    // No zoom buttons: scroll, pinch and double-click zoom, and the globe stays uncluttered.
    instance.on("style.load", () => {
      instance.setProjection({ type: "globe" });
      addFireLayers(instance, FIRST_LABEL_LAYER, useStore.getState().ramp);
      addAnomalyLayer(instance, FIRST_LABEL_LAYER);
      addTrendLayer(instance, FIRST_LABEL_LAYER);
      addSelectionLayers(instance, FIRST_LABEL_LAYER);
      setFireLatitude(instance, instance.getCenter().lat);
      setGlowLatitude(instance, instance.getCenter().lat);
      setMap(instance);
    });
    // Keep the glow even across latitudes (see setFireLatitude).
    instance.on("moveend", () => {
      setFireLatitude(instance, instance.getCenter().lat);
      setGlowLatitude(instance, instance.getCenter().lat);
    });
    return () => {
      creditsObserver.disconnect();
      document.documentElement.style.removeProperty("--credit");
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

  // Recolour the fire cells when the ramp switch changes.
  useEffect(() => {
    if (map) setFireRamp(map, ramp);
  }, [map, ramp]);

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
    for (const id of ANOMALY_LAYER_IDS) map.setLayoutProperty(id, "visibility", visible(view === "anomaly"));
    for (const id of TREND_LAYER_IDS) map.setLayoutProperty(id, "visibility", visible(view === "trend"));
  }, [map, view]);

  // Outline the selected box and fit the map to it. Clearing the box goes back to the globe.
  const hadBox = useRef(false);
  useEffect(() => {
    if (!map) return;
    setSelectedBox(map, bbox);
    const animate = !reducedMotion();
    if (bbox) {
      clearPadding(map);
      map.fitBounds(
        [
          [bbox.west, bbox.south],
          [bbox.east, bbox.north],
        ],
        // Extra room keeps the box clear of the insights panel (on the right, or on a phone the
        // sheet along the bottom), the map tools and the time-lapse bar.
        { padding: fitPadding({ insights: true, bases: false }), maxZoom: 10, animate, duration: 1400 },
      );
    } else if (hadBox.current) {
      map.flyTo({ ...homeView(), padding: NO_PADDING, animate, duration: 1400 });
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

  // Hovering a cell shows its exact numbers; on a touch screen, tapping it does, and a tap
  // anywhere else puts the numbers away. Hidden layers get no events, so only the current view
  // answers.
  const periodLabel = period.label;
  useEffect(() => {
    if (!map || drawing) return;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "pyronac-popup",
    });
    // A base marker has a pop-up of its own (bases/layer.ts), so the cell under it stays quiet.
    const show = (e: maplibregl.MapMouseEvent, html: string) => {
      if (baseMarkerAt(map, e.point)) return popup.remove();
      popup.options.anchor = popupAnchor(e.point);
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    const fire = (e: maplibregl.MapLayerMouseEvent) => {
      const value: unknown = e.features?.[0]?.properties?.value;
      if (typeof value !== "number") return;
      show(e, `<strong>${formatCount(value)}</strong> hot spot${value === 1 ? "" : "s"}<br><span>${periodLabel}</span>`);
    };
    const anomalyCell = (e: maplibregl.MapLayerMouseEvent) => {
      const properties = e.features?.[0]?.properties;
      const value: unknown = properties?.value;
      const median: unknown = properties?.median;
      const percentile: unknown = properties?.percentile;
      const cls: unknown = properties?.cls;
      if (typeof value !== "number" || typeof median !== "number") return;
      if (typeof percentile !== "number" || typeof cls !== "number") return;
      show(
        e,
        `<strong>${sentenceCase(ANOMALY_CLASSES[cls]?.label ?? "")}</strong><br>` +
          `${formatCount(value)} hot spot${value === 1 ? "" : "s"} in ${anomalyLabel ?? "this month"}<br>` +
          `<span>usually ${formatCount(median)} (median) · ${ordinal(percentile)} percentile</span>`,
      );
    };
    const trendCell = (e: maplibregl.MapLayerMouseEvent) => {
      const properties = e.features?.[0]?.properties;
      const slope: unknown = properties?.slope;
      const mean: unknown = properties?.mean;
      if (typeof slope !== "number" || typeof mean !== "number") return;
      show(
        e,
        `<strong>${signedCount(slope)} hot spots a year</strong>, each year<br>` +
          `${trendYearsLabel}, harmonized<br>` +
          `<span>about ${formatCount(Math.round(mean * 10) / 10)} a year on average</span>`,
      );
    };
    const layers = [
      { id: LAYER_FILL, show: fire },
      { id: ANOMALY_LAYER, show: anomalyCell },
      { id: TREND_LAYER, show: trendCell },
    ];
    const subscriptions = layers.flatMap((layer) => [
      map.on("mousemove", layer.id, layer.show),
      map.on("click", layer.id, layer.show),
      map.on("mouseleave", layer.id, () => popup.remove()),
    ]);
    // A tap that lands on no cell.
    subscriptions.push(
      map.on("click", (e) => {
        const ids = layers.map((layer) => layer.id).filter((id) => map.getLayer(id));
        if (map.queryRenderedFeatures(e.point, { layers: ids }).length === 0) popup.remove();
      }),
    );
    return () => {
      for (const subscription of subscriptions) subscription.unsubscribe();
      popup.remove();
    };
  }, [map, periodLabel, anomalyLabel, trendYearsLabel, drawing]);

  const active = anomalyOn ? anomaly : grid;

  function showWholeGlobe() {
    map?.flyTo({ ...homeView(), padding: NO_PADDING, animate: !reducedMotion(), duration: 1400 });
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
      {/* The map tools come first so Tab reaches them before the map itself. layout.css places
          them: one row in a wide window, two on a phone. */}
      <div className="map-toolbar">
        <div className="map-panel seg toolbar-region">
          <RegionPanel
            drawing={drawing}
            disabled={!map}
            onDraw={() => setDrawing((d) => !d)}
            onWholeGlobe={showWholeGlobe}
          />
        </div>
        {!drawing && (
          <div className="toolbar-group">
            <div role="group" aria-label="Map view" className="map-panel seg toolbar-views">
              {(["fire", "anomaly", "trend"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className="map-btn"
                >
                  {v === "fire" ? "Hot spots" : v === "anomaly" ? "Anomaly" : "Trend"}
                </button>
              ))}
            </div>
            <BasesTopButton />
          </div>
        )}
      </div>
      <Starfield />
      <GlobeRim map={map} />
      <div ref={containerRef} className="pyronac-map" />
      {/* Below the toolbar so a long message never covers the buttons. */}
      <div className="map-status">
        {drawing && (
          <div
            role="status"
            className={`map-panel px-4 py-2 text-xs ${drawProblem ? "text-[var(--warn)]" : "text-[var(--text-dim)]"}`}
          >
            {drawProblem ??
              (canHover()
                ? "Press, drag and release on the globe. Esc cancels."
                : "Drag one finger across the globe to draw the area.")}
          </div>
        )}
        {trendOn ? (
          trendMap.error ? (
            <div role="alert" className="map-panel px-3 py-1.5 text-xs text-[var(--text)]">
              Could not load the trend: {trendMap.error.message}
            </div>
          ) : (
            trendMap.enough &&
            !trendMap.trends && (
              <div role="status" className="map-panel px-3 py-1.5 text-xs text-[var(--text-dim)]">
                Loading the trend: {trendMap.done} of {trendMap.total} years…
              </div>
            )
          )
        ) : anomalyOn && !bbox ? (
          <div role="status" className="map-panel px-3 py-1.5 text-xs text-[var(--text-dim)]">
            Pick an area to see how unusual {anomalyLabel ?? "the month"} was there.
          </div>
        ) : active.isError ? (
          <div
            role="alert"
            className="pointer-events-auto flex items-center gap-3 map-panel px-3 py-1.5 text-xs text-[var(--text)]"
          >
            <span>
              Could not load {anomalyOn ? "the anomaly map" : "hot spots"}: {active.error?.message}
            </span>
            <button
              type="button"
              onClick={() => void active.refetch()}
              className="rounded-[4px] border border-[var(--border-strong)] px-2 py-0.5 text-xs hover:bg-[var(--panel-2)]"
            >
              Try again
            </button>
          </div>
        ) : (
          (active.isFetching || !map) && (
            <div
              role="status"
              className="map-panel px-3 py-1.5 text-xs text-[var(--text-dim)]"
            >
              {!map ? "Loading the globe…" : anomalyOn ? "Loading the anomaly map…" : "Loading hot spots…"}
            </div>
          )
        )}
      </div>
      {/* The legend and the time-lapse: side by side in a wide window, stacked on a phone. */}
      <div className="map-bottom">
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
      </div>
    </>
  );
}
