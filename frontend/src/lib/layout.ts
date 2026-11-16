// What the code needs to know about the window's shape. The layout itself is in layout.css.
import { useSyncExternalStore } from "react";

// A phone held upright: the panels are sheets that rise from the bottom. The same number as the
// compact breakpoint in layout.css.
const COMPACT = "(max-width: 639px)";
// A phone on its side: the same number as the short breakpoint in layout.css.
const SHORT_BELOW = 520;

export function isCompact(): boolean {
  return window.matchMedia(COMPACT).matches;
}

function watchCompact(onChange: () => void): () => void {
  const query = window.matchMedia(COMPACT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useCompact(): boolean {
  return useSyncExternalStore(watchCompact, isCompact);
}

// False on a touch screen, where there is no pointer to hold over a thing: it is tapped instead.
export function canHover(): boolean {
  return !window.matchMedia("(hover: none)").matches;
}

// "Hover" for a mouse, "Tap" for a finger, to start a hint with.
export function pointVerb(): "Hover" | "Tap" {
  return canHover() ? "Hover" : "Tap";
}

// Which way a map pop-up opens from its point. MapLibre keeps a pop-up inside the map on its own,
// but the map runs under the tools along the top, so near them the pop-up opens downward, and
// near a side it opens toward the middle.
export function popupAnchor(point: { x: number; y: number }) {
  const toolbar = document.querySelector(".map-toolbar")?.getBoundingClientRect().bottom ?? 56;
  const vertical = point.y < toolbar + 110 ? "top" : "bottom";
  const half = 135; // half the widest pop-up
  if (point.x < half) return `${vertical}-left` as const;
  if (point.x > window.innerWidth - half) return `${vertical}-right` as const;
  return vertical;
}

type Padding = { top: number; right: number; bottom: number; left: number };

function size(selector: string): { width: number; height: number } {
  const el = document.querySelector<HTMLElement>(selector);
  // offsetWidth and offsetHeight ignore the slide-in animation, which a bounding box would not.
  return { width: el?.offsetWidth ?? 0, height: el?.offsetHeight ?? 0 };
}

// The room to leave around a place the map zooms to, so the floating panels do not cover it.
// `open` says which panels are showing. It measures them, so call it once they are on the page.
export function fitPadding(open: { insights: boolean; bases: boolean }): Padding {
  const { innerWidth: width, innerHeight: height } = window;
  const toolbar = document.querySelector(".map-toolbar")?.getBoundingClientRect().bottom ?? 56;
  // The insights panel stays on the page while it is closed or behind the planner's sheet.
  const insights = open.insights ? size(".insights-sheet:not(.is-closed)") : { width: 0, height: 0 };
  const bases = open.bases ? size(".bases-panel") : { width: 0, height: 0 };

  let padding: Padding;
  if (isCompact()) {
    // A sheet covers the bottom of the map. With none open, the legend and the time-lapse are
    // there. The map credits sit on top of either.
    const sheet = Math.max(insights.height, bases.height);
    const covered = (sheet || size(".map-bottom").height) + size(".maplibregl-ctrl-attrib").height;
    padding = { top: toolbar + 20, right: 24, bottom: covered + 16, left: 24 };
  } else {
    const short = height <= SHORT_BELOW;
    padding = {
      top: toolbar + (short ? 14 : 36),
      right: insights.width ? insights.width + 40 : 80,
      bottom: short ? 64 : 120,
      left: bases.width ? bases.width + 40 : 80,
    };
  }

  // MapLibre does not move at all when the padding leaves too little room, so always leave a
  // good share of the window, even if that puts part of the place under a panel.
  const across = padding.left + padding.right;
  const roomAcross = Math.max(96, width * 0.3);
  if (across > width - roomAcross) {
    const scale = (width - roomAcross) / across;
    padding.left = Math.floor(padding.left * scale);
    padding.right = Math.floor(padding.right * scale);
  }
  const down = padding.top + padding.bottom;
  const roomDown = Math.max(96, height * 0.2);
  if (down > height - roomDown) {
    const scale = (height - roomDown) / down;
    padding.top = Math.floor(padding.top * scale);
    padding.bottom = Math.floor(padding.bottom * scale);
  }
  return padding;
}
