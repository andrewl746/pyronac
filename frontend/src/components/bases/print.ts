// "Print base list (PDF)": a picture of the map, then the browser's print dialog with the base
// list layout (bases.css). The map is not created with preserveDrawingBuffer, so its canvas is
// read inside a "render" event, right after MapLibre has drawn the frame and before it is cleared.
import type { Map as MapLibreMap } from "maplibre-gl";
import { flushSync } from "react-dom";
import { circlesBounds } from "./geo";
import { useBases } from "./store";
import type { BaseSite } from "./types";

export const PRINTING_CLASS = "printing-bases";

// Resolves on the map's next "idle" (every tile drawn), or after `ms` at the latest.
function settled(map: MapLibreMap, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    map.once("idle", () => {
      window.clearTimeout(timer);
      resolve();
    });
    map.triggerRepaint();
  });
}

function readCanvas(map: MapLibreMap): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 2000);
    map.once("render", () => {
      window.clearTimeout(timer);
      try {
        resolve(map.getCanvas().toDataURL("image/png"));
      } catch {
        resolve(null); // a tainted canvas
      }
    });
    map.triggerRepaint();
  });
}

// True when the picture came out empty: every pixel see-through, or every pixel one colour.
async function isBlank(url: string): Promise<boolean> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let seen = false;
  let varied = false;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 0) seen = true;
    if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) varied = true;
  }
  return !seen || !varied;
}

// Fits the map to the sites and their circles, waits for the tiles, and returns a PNG data URL,
// or null when the picture could not be taken (the printed list then shows a simple sketch).
export async function mapPicture(map: MapLibreMap, sites: BaseSite[], km: number): Promise<string | null> {
  const bounds = circlesBounds(sites, km);
  if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 7, animate: false });
  await settled(map, 8000);
  const url = await readCanvas(map);
  if (!url) return null;
  try {
    return (await isBlank(url)) ? null : url;
  } catch {
    return null;
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

// Renders the print layout, opens the print dialog, and puts the page back afterwards.
export async function printBaseList(sites: BaseSite[], km: number): Promise<void> {
  const { map, setPrinting } = useBases.getState();
  const image = map ? await mapPicture(map, sites, km) : null;
  flushSync(() => setPrinting(true, image));
  document.body.classList.add(PRINTING_CLASS);
  await nextFrame();
  const done = () => {
    document.body.classList.remove(PRINTING_CLASS);
    useBases.getState().setPrinting(false);
  };
  window.addEventListener("afterprint", done, { once: true });
  window.print();
}
