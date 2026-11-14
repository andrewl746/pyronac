import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGrid } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { snapBbox, WORLD } from "../../lib/geo";
import { useStore } from "../../state/store";
import { BASEMAP, FIRST_LABEL_LAYER } from "./basemap";
import { addFireLayers, LAYER_FILL, setFireData } from "./fire";
import { formatCount } from "../../lib/format";
import { mapPeriod } from "./labels";
import Legend from "./Legend";
import "./map.css";
import { addSelectionLayers, setSelectedBox, useDrawBox } from "./selection";

// The opening view from MASTERSPEC.md section 8: the globe, centred over Canada.
const START = { center: [-100, 55] as [number, number], zoom: 1.8 };
// With no box selected the map asks for the whole world in 1 degree cells.
const WORLD_STEP = 10;

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

  // Draw the fire cells whenever new grid data arrives.
  useEffect(() => {
    if (map) setFireData(map, grid.data);
  }, [map, grid.data]);

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
        { padding: 64, maxZoom: 10, animate, duration: 1400 },
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

  // Hovering a cell shows its exact count.
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
    return () => {
      move.unsubscribe();
      leave.unsubscribe();
      popup.remove();
    };
  }, [map, periodLabel, drawing]);

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
      <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
        {grid.isError ? (
          <div
            role="alert"
            className="pointer-events-auto flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--text)] shadow-lg"
          >
            <span>Could not load hot spots: {grid.error.message}</span>
            <button
              type="button"
              onClick={() => void grid.refetch()}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--panel-2)]"
            >
              Try again
            </button>
          </div>
        ) : (
          (grid.isFetching || !map) && (
            <div
              role="status"
              className="rounded-md bg-[var(--panel)]/90 px-3 py-1.5 text-xs text-[var(--text-dim)] shadow-lg"
            >
              {map ? "Loading hot spots…" : "Loading the globe…"}
            </div>
          )
        )}
      </div>
      <Legend
        max={grid.data?.max ?? 0}
        step={grid.data?.step ?? WORLD_STEP}
        period={period.label}
        loading={grid.isPending}
        failed={grid.isError}
      />
    </>
  );
}
