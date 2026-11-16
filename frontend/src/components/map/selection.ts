// The selected box on the map, and the rectangle the user drags in draw mode.
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { GeoJSONSource, LngLat, Map as MapLibreMap, MapMouseEvent, MapTouchEvent, Point } from "maplibre-gl";
import { useEffect, useState } from "react";
import type { Bbox } from "../../api/types";
import { crossesDateLine, dragBox } from "../../lib/geo";

const ACCENT = "#8fb8de"; // --accent in the theme
const SOURCE_SELECTED = "selected-box";
const SOURCE_DRAW = "draw-box";
const SOURCE_MASK = "selected-mask";
// The world outside the selected box is dimmed this much, which also stops the fire glow at the
// box edge (the glow spreads a little past the last cell).
const MASK_OPACITY = 0.82;
const MASK_LAT = 85.0511; // the globe has no tiles beyond this
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
  map.addSource(SOURCE_MASK, { type: "geojson", data: EMPTY });
  // Above the fire, trend and anomaly layers (added before this) and under the outline.
  map.addLayer(
    {
      id: "selected-mask",
      type: "fill",
      source: SOURCE_MASK,
      paint: { "fill-color": "#010205", "fill-opacity": MASK_OPACITY, "fill-antialias": false },
    },
    beforeId,
  );
  // A dark casing under the outline keeps it visible on bright snow and desert.
  map.addLayer(
    {
      id: "selected-box-casing",
      type: "line",
      source: SOURCE_SELECTED,
      paint: { "line-color": "rgba(0, 0, 0, 0.5)", "line-width": 3 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "selected-box-line",
      type: "line",
      source: SOURCE_SELECTED,
      paint: { "line-color": ACCENT, "line-width": 1.25, "line-dasharray": [4, 2] },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "draw-box-fill",
      type: "fill",
      source: SOURCE_DRAW,
      paint: { "fill-color": ACCENT, "fill-opacity": 0.06 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "draw-box-line",
      type: "line",
      source: SOURCE_DRAW,
      paint: { "line-color": ACCENT, "line-width": 1.25 },
    },
    beforeId,
  );
}

// The whole world with the box cut out of it.
function worldMinusBox(b: Bbox): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-180, -MASK_LAT],
          [180, -MASK_LAT],
          [180, MASK_LAT],
          [-180, MASK_LAT],
          [-180, -MASK_LAT],
        ],
        [
          [b.west, b.south],
          [b.west, b.north],
          [b.east, b.north],
          [b.east, b.south],
          [b.west, b.south],
        ],
      ],
    },
  };
}

export function setSelectedBox(map: MapLibreMap, bbox: Bbox | null): void {
  map.getSource<GeoJSONSource>(SOURCE_SELECTED)?.setData(bbox ? boxPolygon(bbox) : EMPTY);
  map.getSource<GeoJSONSource>(SOURCE_MASK)?.setData(bbox ? worldMinusBox(bbox) : EMPTY);
}

export const DATE_LINE_PROBLEM = "A box can't cross the 180° line. Draw it on one side of the line.";

// Draw mode: panning is off and the cursor is a crosshair. Press, drag and release makes a box
// and calls onDone with it (not yet snapped). Escape calls onCancel. On a touch screen one finger
// draws the box the same way, and two fingers still zoom the map.
// A box across the 180° line is refused (issue #10): draw mode stays on and the hook returns a
// message to show, until the next press or until draw mode turns off.
// onDone and onCancel must be stable (useCallback), or the mode restarts on every render.
export function useDrawBox(
  map: MapLibreMap | null,
  active: boolean,
  onDone: (bbox: Bbox) => void,
  onCancel: () => void,
): string | null {
  const [problem, setProblem] = useState<string | null>(null);
  // Turning draw mode on or off clears the message.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    setProblem(null);
  }

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
    // With panning off, MapLibre hands one-finger drags back to the browser, which would end the
    // touch as soon as it moved. Keep them for the box.
    const touchTargets = [map.getCanvasContainer(), canvas];
    for (const el of touchTargets) el.style.touchAction = "none";

    const down = map.on("mousedown", (e: MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      e.preventDefault();
      start = { lngLat: e.lngLat.wrap(), point: e.point };
      last = start;
      setProblem(null);
    });
    const move = map.on("mousemove", (e: MapMouseEvent) => {
      if (!start) return;
      last = { lngLat: e.lngLat.wrap(), point: e.point };
      preview?.setData(boxPolygon(dragBox(start.lngLat, last.lngLat)));
    });
    const finish = () => {
      if (!start || !last) return;
      const wide = Math.abs(last.point.x - start.point.x) >= MIN_DRAG_PX;
      const tall = Math.abs(last.point.y - start.point.y) >= MIN_DRAG_PX;
      const box = dragBox(start.lngLat, last.lngLat);
      start = null;
      preview?.setData(EMPTY);
      if (!wide || !tall) return;
      if (crossesDateLine(box)) setProblem(DATE_LINE_PROBLEM);
      else onDone(box);
    };
    const up = map.on("mouseup", finish);
    const drop = () => {
      start = null;
      preview?.setData(EMPTY);
    };
    const touchStart = map.on("touchstart", (e: MapTouchEvent) => {
      // A second finger means a pinch: drop the box and let the map zoom.
      if (e.points.length !== 1) return drop();
      start = { lngLat: e.lngLat.wrap(), point: e.point };
      last = start;
      setProblem(null);
    });
    const touchMove = map.on("touchmove", (e: MapTouchEvent) => {
      if (!start || e.points.length !== 1) return;
      last = { lngLat: e.lngLat.wrap(), point: e.point };
      preview?.setData(boxPolygon(dragBox(start.lngLat, last.lngLat)));
    });
    const touchEnd = map.on("touchend", finish);
    const touchCancel = map.on("touchcancel", drop);
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
      touchStart.unsubscribe();
      touchMove.unsubscribe();
      touchEnd.unsubscribe();
      touchCancel.unsubscribe();
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("keydown", onKey);
      map.dragPan.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
      canvas.style.cursor = "";
      for (const el of touchTargets) el.style.touchAction = "";
      preview?.setData(EMPTY);
    };
  }, [map, active, onDone, onCancel]);

  return problem;
}
