// The base planner on the map: the first N sites as numbered markers with their reach circles.
// MapView calls useBaseLayer(map) once. Nothing is added to the map until "Fire bases" is first
// switched on, so with the planner off the map is exactly as before.
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { canHover, fitPadding, popupAnchor } from "../../lib/layout";
import { useStore } from "../../state/store";
import { FIRST_LABEL_LAYER } from "../map/basemap";
import { clearPadding } from "../map/home";
import { reachResult, useBaseSites } from "./data";
import { circlesGeoJson, pointsGeoJson } from "./geo";
import { earlySentence, percentOne, townLabel } from "./sentences";
import { useBases } from "./store";
import type { BaseSite } from "./types";

const SOURCE_CIRCLES = "base-circles";
const SOURCE_POINTS = "base-points";
export const BASE_MARKER_LAYER = "base-marker";
const LAYER_IDS = ["base-circle-fill", "base-circle-casing", "base-circle-line", BASE_MARKER_LAYER, "base-label"];

// White with a dark edge reads over the night globe, the heatmap glow at its brightest, and the
// dimmed area outside a selected box.
const LIGHT = "#ffffff";
const DARK = "#07090c"; // --bg in the theme

// Where the planner's sites are: southern Canada to the treeline, coast to coast.
const CANADA: [[number, number], [number, number]] = [
  [-141, 44],
  [-52.6, 70],
];

const EMPTY = { type: "FeatureCollection" as const, features: [] };

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A finger is less exact than a mouse, so on a touch screen a tap this many pixels from a marker
// still counts as on it.
const TAP_REACH = 12;

// The ranks of the base markers at a point on the map, or near it on a touch screen.
function ranksAt(map: MapLibreMap, point: { x: number; y: number }): number[] {
  if (!map.getLayer(BASE_MARKER_LAYER)) return [];
  const reach = canHover() ? 0 : TAP_REACH;
  const features = map.queryRenderedFeatures(
    [
      [point.x - reach, point.y - reach],
      [point.x + reach, point.y + reach],
    ],
    { layers: [BASE_MARKER_LAYER] },
  );
  return features.map((f) => f.properties?.rank).filter((r): r is number => typeof r === "number");
}

// True where a click or tap is on a base marker, so the map's other pop-ups leave it alone.
export function baseMarkerAt(map: MapLibreMap, point: { x: number; y: number }): boolean {
  return ranksAt(map, point).length > 0;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function addLayers(map: MapLibreMap): void {
  if (map.getSource(SOURCE_POINTS)) return;
  map.addSource(SOURCE_CIRCLES, { type: "geojson", data: EMPTY });
  map.addSource(SOURCE_POINTS, { type: "geojson", data: EMPTY });
  // The circles go over the fire layers but under the place names.
  map.addLayer(
    {
      id: "base-circle-fill",
      type: "fill",
      source: SOURCE_CIRCLES,
      paint: { "fill-color": LIGHT, "fill-opacity": 0.1 },
    },
    FIRST_LABEL_LAYER,
  );
  map.addLayer(
    {
      id: "base-circle-casing",
      type: "line",
      source: SOURCE_CIRCLES,
      paint: { "line-color": "rgba(0, 0, 0, 0.6)", "line-width": 3.5 },
    },
    FIRST_LABEL_LAYER,
  );
  map.addLayer(
    {
      id: "base-circle-line",
      type: "line",
      source: SOURCE_CIRCLES,
      paint: { "line-color": LIGHT, "line-width": 1.6 },
    },
    FIRST_LABEL_LAYER,
  );
  // The numbered markers go on top of everything, with base 1 drawn last so it stays on top.
  map.addLayer({
    id: BASE_MARKER_LAYER,
    type: "circle",
    source: SOURCE_POINTS,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 7, 6, 11],
      "circle-color": LIGHT,
      "circle-stroke-color": DARK,
      "circle-stroke-width": 1.5,
    },
    layout: { "circle-sort-key": ["-", ["get", "rank"]] },
  });
  map.addLayer({
    id: "base-label",
    type: "symbol",
    source: SOURCE_POINTS,
    layout: {
      "text-field": ["to-string", ["get", "rank"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 12],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "symbol-sort-key": ["-", ["get", "rank"]],
    },
    paint: { "text-color": DARK },
  });
}

function popupHtml(site: BaseSite): string {
  return (
    `<strong>Base ${site.rank}</strong>, ${escapeHtml(townLabel(site))}<br>` +
    `${site.lat.toFixed(2)}, ${site.lon.toFixed(2)} · adds ${percentOne(site.adds)}<br>` +
    `<span>${escapeHtml(earlySentence(site))}</span>`
  );
}

export function useBaseLayer(map: MapLibreMap | null): void {
  const on = useBases((s) => s.on);
  const count = useBases((s) => s.count);
  const reach = useBases((s) => s.reach);
  const setMap = useBases((s) => s.setMap);
  const result = reachResult(useBaseSites(on).data, reach);

  // The print button takes its picture of the map through the store.
  useEffect(() => {
    setMap(map);
    return () => setMap(null);
  }, [map, setMap]);

  // Add the layers the first time the planner is switched on.
  useEffect(() => {
    if (map && on) addLayers(map);
  }, [map, on]);

  // Draw the first N sites, or nothing when the planner is off.
  const sitesRef = useRef<BaseSite[]>([]);
  // A base's popup describes one list, so it closes whenever the list shown changes.
  const popupRef = useRef<maplibregl.Popup | null>(null);
  useEffect(() => {
    if (!map || !map.getSource(SOURCE_POINTS)) return;
    const shown = on && result ? result.sites.slice(0, count) : [];
    sitesRef.current = shown;
    map.getSource<GeoJSONSource>(SOURCE_CIRCLES)?.setData(result && shown.length ? circlesGeoJson(shown, result.reach_km) : EMPTY);
    map.getSource<GeoJSONSource>(SOURCE_POINTS)?.setData(shown.length ? pointsGeoJson(shown) : EMPTY);
    for (const id of LAYER_IDS) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    popupRef.current?.remove();
  }, [map, on, reach, count, result]);

  // Zoom to Canada when the planner is switched on, or when the map finishes loading if the
  // switch was turned on before it had.
  const wasOn = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (on && !wasOn.current) {
      clearPadding(map);
      map.fitBounds(CANADA, {
        // Room for the planner's own panel and, when an area is selected, its insights panel.
        padding: fitPadding({ insights: useStore.getState().bbox !== null, bases: true }),
        animate: !reducedMotion(),
        duration: 1400,
      });
    }
    wasOn.current = on;
  }, [map, on]);

  // Clicking a marker shows that base's numbers. The table in the sidebar has the same numbers
  // for keyboard and screen reader users.
  useEffect(() => {
    if (!map || !on) return;
    const popup = new maplibregl.Popup({ closeButton: true, offset: 12, className: "pyronac-popup", maxWidth: "260px" });
    popupRef.current = popup;
    const canvas = map.getCanvas();
    const click = map.on("click", (e) => {
      if (!map.dragPan.isEnabled()) return; // draw mode is on
      // Where markers overlap, the lowest number is the one drawn on top.
      const ranks = ranksAt(map, e.point);
      if (ranks.length === 0) return;
      const rank = Math.min(...ranks);
      const site = sitesRef.current.find((s) => s.rank === rank);
      if (!site) return;
      popup.options.anchor = popupAnchor(map.project([site.lon, site.lat]));
      popup.setLngLat([site.lon, site.lat]).setHTML(popupHtml(site)).addTo(map);
    });
    const enter = map.on("mouseenter", BASE_MARKER_LAYER, () => {
      if (canvas.style.cursor === "") canvas.style.cursor = "pointer";
    });
    const leave = map.on("mouseleave", BASE_MARKER_LAYER, () => {
      if (canvas.style.cursor === "pointer") canvas.style.cursor = "";
    });
    return () => {
      click.unsubscribe();
      enter.unsubscribe();
      leave.unsubscribe();
      popup.remove();
    };
  }, [map, on]);
}
