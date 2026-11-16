// The app's opening view: the whole globe, centred over Canada.
import type { Map as MapLibreMap } from "maplibre-gl";

export const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

// The opening screen frames its shot with padding on the map, and lets go of it while the camera
// levels out (Intro.tsx). A zoom to a place that starts before that has finished would get the
// leftover added to its own padding, and on a phone MapLibre then finds no room and does not move
// at all. So every such zoom clears the leftover first.
export function clearPadding(map: MapLibreMap): void {
  const p = map.getPadding();
  if (p.top || p.right || p.bottom || p.left) map.setPadding(NO_PADDING);
}

const CENTER: [number, number] = [-100, 55];
const ZOOM = 1.8; // in a desktop window
const TAN_HALF_FOV = Math.tan((36.87 / 2) * (Math.PI / 180)); // MapLibre's default field of view

// The zoom at which the globe's outline is `diameter` pixels across in a view `viewHeight` pixels
// tall. This is globeRadius in GlobeRim.tsx, solved for the zoom.
function zoomForGlobe(diameter: number, viewHeight: number): number {
  const seen = diameter / 2;
  const camera = viewHeight / 2 / TAN_HALF_FOV;
  const radius = (seen * seen + seen * Math.hypot(seen, camera)) / camera;
  const worldSize = radius * 2 * Math.PI * Math.cos((CENTER[1] * Math.PI) / 180);
  return Math.log2(worldSize / 512);
}

// At the desktop zoom a phone would show only a slice of the globe, so in a small window the view
// pulls back until the globe fits across it. A desktop window gets the desktop zoom, as before.
// Level and north up, whatever the camera was doing.
export function homeView() {
  const { innerWidth: width, innerHeight: height } = window;
  const zoom = Math.min(ZOOM, zoomForGlobe(Math.min(0.94 * width, 1.1 * height), height));
  return { center: CENTER, zoom, pitch: 0, bearing: 0 };
}

// How far out the map may zoom: far enough for the whole globe to fit a phone held either way.
export function minZoom(): number {
  const narrow = Math.min(window.innerWidth, window.innerHeight);
  const tall = Math.max(window.innerWidth, window.innerHeight);
  return Math.min(0.5, zoomForGlobe(0.94 * narrow, tall));
}
