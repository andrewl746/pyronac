// The picture of the map for the downloaded base list (pdf.ts). The map is not created with
// preserveDrawingBuffer, so its canvas is read inside a "render" event, right after MapLibre has
// drawn the frame and before it is cleared.
import type { Map as MapLibreMap } from "maplibre-gl";
import { circlesBounds } from "./geo";
import type { BaseSite } from "./types";

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

// True when the map's frame came out empty: every pixel see-through, or every pixel one colour.
function isBlank(source: HTMLCanvasElement): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let seen = false;
  let varied = false;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 0) seen = true;
    if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) varied = true;
  }
  return !seen || !varied;
}

// The picture is at most the page's text width (about 703 CSS px on A4) and 120 mm (about 453 CSS
// px) tall in the PDF (pdf.ts).
const PRINT_WIDTH = 703;
const PRINT_HEIGHT = 453;
const PRINTED_TEXT_PX = 9; // how big the numbers come out on paper

// The map's own numbers are sized for the screen and become specks when the picture is shrunk to
// the page, so each base's number is drawn again on top of the picture, sized for paper, at the
// site's position on the map. Base 1 is drawn last so it stays on top where markers overlap.
function drawNumbers(context: CanvasRenderingContext2D, map: MapLibreMap, sites: BaseSite[]): void {
  const canvas = context.canvas;
  const ratio = canvas.width / map.getCanvas().clientWidth; // canvas pixels per CSS pixel
  const shrink = Math.min(PRINT_WIDTH / canvas.width, PRINT_HEIGHT / canvas.height, 1);
  const font = Math.round(PRINTED_TEXT_PX / shrink);
  const radius = font * 0.85;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${font}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
  context.lineWidth = Math.max(1, font * 0.12);
  for (const site of [...sites].reverse()) {
    const point = map.project([site.lon, site.lat]);
    const x = point.x * ratio;
    const y = point.y * ratio;
    if (x < -radius || y < -radius || x > canvas.width + radius || y > canvas.height + radius) continue;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = "#07090c";
    context.stroke();
    context.fillStyle = "#07090c";
    context.fillText(String(site.rank), x, y + font * 0.04);
  }
}

// Takes the next frame the map draws, with every base's number drawn on top for paper.
function takePicture(map: MapLibreMap, sites: BaseSite[]): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 2000);
    map.once("render", () => {
      window.clearTimeout(timer);
      try {
        const source = map.getCanvas();
        if (isBlank(source)) {
          resolve(null);
          return;
        }
        const picture = document.createElement("canvas");
        picture.width = source.width;
        picture.height = source.height;
        const context = picture.getContext("2d");
        if (!context) {
          resolve(source.toDataURL("image/png"));
          return;
        }
        context.drawImage(source, 0, 0);
        drawNumbers(context, map, sites);
        resolve(picture.toDataURL("image/png"));
      } catch {
        resolve(null); // a tainted canvas
      }
    });
    map.triggerRepaint();
  });
}

// Fits the map to the sites and their circles, waits for the tiles, and returns a PNG data URL,
// or null when the picture could not be taken (the PDF then says so).
export async function mapPicture(map: MapLibreMap, sites: BaseSite[], km: number): Promise<string | null> {
  const bounds = circlesBounds(sites, km);
  if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 7, animate: false });
  await settled(map, 8000);
  return takePicture(map, sites);
}
