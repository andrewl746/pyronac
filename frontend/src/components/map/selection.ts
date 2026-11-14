// The selected box on the map, and the rectangle the user drags in draw mode (MASTERSPEC.md section 8).
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { GeoJSONSource, LngLat, Map as MapLibreMap, MapMouseEvent, Point } from "maplibre-gl";
import { useEffect } from "react";
import type { Bbox } from "../../api/types";

const ACCENT = "#ff8a3d"; // --accent in the theme
const SOURCE_SELECTED = "selected-box";
const SOURCE_DRAW = "draw-box";
// A press and release that moves less than this many pixels is a click, not a box.
const MIN_DRAG_PX = 6;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function boxPolygon(b: Bbox): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [b.west, b.south],
          [b.east, b.south],
          [b.east, b.north],
          [b.west, b.north],
          [b.west, b.south],
        ],
      ],
    },
  };
}

export function addSelectionLayers(map: MapLibreMap, beforeId: string): void {
  map.addSource(SOURCE_SELECTED, { type: "geojson", data: EMPTY });
  map.addSource(SOURCE_DRAW, { type: "geojson", data: EMPTY });
  // A dark casing under the outline keeps it visible on bright snow and desert.
  map.addLayer(
    {
      id: "selected-box-casing",
      type: "line",
      source: SOURCE_SELECTED,
      paint: { "line-color": "rgba(0, 0, 0, 0.55)", "line-width": 5 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "selected-box-line",
      type: "line",
      source: SOURCE_SELECTED,
      paint: { "line-color": ACCENT, "line-width": 2.5, "line-dasharray": [3, 1.5] },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "draw-box-fill",
      type: "fill",
      source: SOURCE_DRAW,
      paint: { "fill-color": ACCENT, "fill-opacity": 0.12 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "draw-box-line",
      type: "line",
      source: SOURCE_DRAW,
      paint: { "line-color": ACCENT, "line-width": 2 },
    },
    beforeId,
  );
}

export function setSelectedBox(map: MapLibreMap, bbox: Bbox | null): void {
  map.getSource<GeoJSONSource>(SOURCE_SELECTED)?.setData(bbox ? boxPolygon(bbox) : EMPTY);
}

function boxBetween(a: LngLat, b: LngLat): Bbox {
  return {
    west: Math.max(-180, Math.min(a.lng, b.lng)),
    east: Math.min(180, Math.max(a.lng, b.lng)),
    south: Math.max(-90, Math.min(a.lat, b.lat)),
    north: Math.min(90, Math.max(a.lat, b.lat)),
  };
}

// Draw mode: panning is off and the cursor is a crosshair. Press, drag and release makes a box
// and calls onDone with it (not yet snapped). Escape calls onCancel.
// onDone and onCancel must be stable (useCallback), or the mode restarts on every render.
export function useDrawBox(
  map: MapLibreMap | null,
  active: boolean,
  onDone: (bbox: Bbox) => void,
  onCancel: () => void,
): void {
  useEffect(() => {
    if (!map || !active) return;
    const canvas = map.getCanvas();
    const preview = map.getSource<GeoJSONSource>(SOURCE_DRAW);
    let start: { lngLat: LngLat; point: Point } | null = null;
    let last: { lngLat: LngLat; point: Point } | null = null;

    map.dragPan.disable();
    map.dragRotate.disable();
    map.doubleClickZoom.disable();
    canvas.style.cursor = "crosshair";

    const down = map.on("mousedown", (e: MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      e.preventDefault();
      start = { lngLat: e.lngLat.wrap(), point: e.point };
      last = start;
    });
    const move = map.on("mousemove", (e: MapMouseEvent) => {
      if (!start) return;
      last = { lngLat: e.lngLat.wrap(), point: e.point };
      preview?.setData(boxPolygon(boxBetween(start.lngLat, last.lngLat)));
    });
    const finish = () => {
      if (!start || !last) return;
      const wide = Math.abs(last.point.x - start.point.x) >= MIN_DRAG_PX;
      const tall = Math.abs(last.point.y - start.point.y) >= MIN_DRAG_PX;
      const box = boxBetween(start.lngLat, last.lngLat);
      start = null;
      preview?.setData(EMPTY);
      if (wide && tall) onDone(box);
    };
    const up = map.on("mouseup", finish);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    // Releasing the button outside the map still finishes the box.
    window.addEventListener("mouseup", finish);
    window.addEventListener("keydown", onKey);

    return () => {
      down.unsubscribe();
      move.unsubscribe();
      up.unsubscribe();
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("keydown", onKey);
      map.dragPan.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
      canvas.style.cursor = "";
      preview?.setData(EMPTY);
    };
  }, [map, active, onDone, onCancel]);
}
