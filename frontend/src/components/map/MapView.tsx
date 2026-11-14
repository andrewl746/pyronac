import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useGrid } from "../../api/hooks";
import { WORLD } from "../../lib/geo";
import { useStore } from "../../state/store";
import { BASEMAP, FIRST_LABEL_LAYER } from "./basemap";
import { addFireLayers, LAYER_FILL, setFireData } from "./fire";
import { formatCount, mapPeriod } from "./labels";
import Legend from "./Legend";
import "./map.css";

// The opening view from MASTERSPEC.md section 8: the globe, centred over Canada.
const START = { center: [-100, 55] as [number, number], zoom: 1.8 };
// With no box selected the map asks for the whole world in 1 degree cells.
const WORLD_STEP = 10;

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  const bbox = useStore((s) => s.bbox);
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

  // Hovering a cell shows its exact count.
  const periodLabel = period.label;
  useEffect(() => {
    if (!map) return;
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
  }, [map, periodLabel]);

  return (
    <>
      <div ref={containerRef} className="pyronac-map" />
      <Legend
        max={grid.data?.max ?? 0}
        step={grid.data?.step ?? WORLD_STEP}
        period={period.label}
        loading={grid.isPending}
      />
    </>
  );
}
