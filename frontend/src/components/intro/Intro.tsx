// The opening screen: the app's own globe, close in over western Canada and tilted, as if seen
// from orbit, with one region's fire of one summer drawn as points of light (embers.ts). On top:
// the name, the tagline, three sentences on what Pyronac is, two ways in, and a caption that says
// what the globe is showing. Every panel of the app is hidden until the viewer goes in
// (intro.css, body.intro-open). It is the same map instance, so nothing loads twice.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGrid, useMeta } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { formatDate } from "../../lib/format";
import { useBases } from "../bases/store";
import { hideEmbers, setEmbers, showEmbers } from "./embers";
import "./intro.css";

// The region and season on the globe. The box is the app's own "British Columbia" preset; this
// copy is used only until /api/meta has answered.
const REGION_ID = "bc";
const REGION_NAME = "British Columbia, Canada";
const REGION_BOX: Bbox = { west: -139.1, south: 48.3, east: -114, north: 60 };
const SEASON = { start: "2023-06", end: "2023-08", label: "June to August 2023" };

// The shot: looking north-east across British Columbia, the Pacific dark on the left behind the
// words and the rest of Canada running to the horizon.
const SHOT = { center: [-123.5, 54.6] as [number, number], zoom: 4.35, pitch: 54, bearing: 22 };
// The one move: the camera starts this much wider and further round, and settles over SETTLE_S.
const LEAD = { zoom: -0.4, bearing: -7 };
const SETTLE_S = 10;
// After that it sways by this many degrees, once every SWAY_S seconds.
const SWAY = 2.5;
const SWAY_S = 80;
// Where the app's own view starts (START in MapView.tsx).
const APP_VIEW = { center: [-100, 55] as [number, number], zoom: 1.8, pitch: 0, bearing: 0 };
const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The words sit on the left of a wide window, so the shot's centre moves right, clear of them.
// In a narrow window (one column, see intro.css) they sit at the bottom, so it moves up and
// pulls back a little.
const ONE_COLUMN_BELOW = 960; // px, the same breakpoint as intro.css
function framing() {
  const width = window.innerWidth;
  if (width < ONE_COLUMN_BELOW) {
    return { zoom: SHOT.zoom - 0.9, padding: { ...NO_PADDING, bottom: Math.round(window.innerHeight * 0.45) } };
  }
  return { zoom: SHOT.zoom, padding: { ...NO_PADDING, left: Math.max(Math.round(width * 0.34), 500) } };
}

const easeOut = (x: number) => 1 - (1 - x) ** 3;

export function Intro() {
  const [open, setOpen] = useState(true);
  const map = useBases((s) => s.map); // the map instance, set by MapView through the planner's hook
  const setBasesOn = useBases((s) => s.setOn);
  const meta = useMeta();
  const preset = meta.data?.presets.find((p) => p.id === REGION_ID);
  const box = preset?.bbox ?? REGION_BOX;
  const grid = useGrid(open ? box : null, SEASON.start, SEASON.end, 1);
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useRef(0); // the camera's animation frame, so going in can stop it at once

  // Hide the app's panels before the first paint, and bring focus back to the map tools after.
  useLayoutEffect(() => {
    document.body.classList.toggle("intro-open", open);
    if (open) rootRef.current?.focus();
    else document.querySelector<HTMLElement>(".map-panel.seg button")?.focus();
    return () => document.body.classList.remove("intro-open");
  }, [open]);

  // Swap the country-wide glow for the region's embers while the opening screen is up.
  useEffect(() => {
    if (!map || !open) return;
    showEmbers(map);
    return () => hideEmbers(map);
  }, [map, open]);

  useEffect(() => {
    if (map && open) setEmbers(map, grid.data, box);
  }, [map, open, grid.data, box]);

  // The camera: one slow settle into the shot, then a sway that is barely there.
  useEffect(() => {
    if (!map || !open) return;
    const { zoom, padding } = framing();
    if (reducedMotion()) {
      map.jumpTo({ ...SHOT, zoom, padding });
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      const settled = easeOut(Math.min(1, t / SETTLE_S));
      const sway = SWAY * Math.sin((2 * Math.PI * Math.max(0, t - SETTLE_S)) / SWAY_S);
      map.jumpTo({
        center: SHOT.center,
        pitch: SHOT.pitch,
        zoom: zoom + LEAD.zoom * (1 - settled),
        bearing: SHOT.bearing + LEAD.bearing * (1 - settled) + sway,
        padding,
      });
      motion.current = requestAnimationFrame(step);
    };
    motion.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(motion.current);
  }, [map, open]);

  // Into the app, on its usual level view. With `bases`, the planner opens once the camera is level.
  function enter(bases: boolean) {
    cancelAnimationFrame(motion.current);
    setOpen(false);
    const m = useBases.getState().map;
    if (!m) {
      if (bases) setBasesOn(true);
      return;
    }
    const animate = !reducedMotion();
    if (bases) {
      m.once("moveend", () => setBasesOn(true));
      m.easeTo({ pitch: 0, bearing: 0, padding: NO_PADDING, animate, duration: 900 });
    } else {
      m.flyTo({ ...APP_VIEW, padding: NO_PADDING, animate, duration: 2400 });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" || (e.key === "Enter" && e.target === e.currentTarget)) {
      e.preventDefault(); // or the same key press would also act on the button that gets the focus next
      enter(false);
    }
  }

  if (!open) return null;

  const through = meta.data?.harmonization.data_through;
  return (
    <div
      ref={rootRef}
      className="intro no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="intro-shade" aria-hidden="true" />
      <div className="intro-copy">
        <h1 id="intro-title" className="intro-title">
          <span className="wordmark intro-wordmark">Pyronac</span>
          <span className="intro-tagline">A fire record to plan with</span>
        </h1>
        <p className="intro-lede">
          Two NASA instruments, MODIS and VIIRS, map fire from orbit but count it differently. Pyronac puts both on
          one scale starting from 2003, then finds the optimal locations to position fire bases in Canada to protect
          the most people. Tested on ten years of data the planner had never seen, its sites reached three times more
          fire than bases placed at random in places that had burned before.
        </p>
        <div className="intro-actions">
          <button type="button" className="intro-btn intro-btn-main" onClick={() => enter(false)}>
            Open the map
          </button>
          <button type="button" className="intro-btn" onClick={() => enter(true)}>
            See the fire bases
          </button>
        </div>
      </div>
      <p className="intro-caption">
        <span>
          On the globe: {preset?.name ?? REGION_NAME}, {SEASON.label}.
        </span>
        <span>
          NASA FIRMS hot spots from MODIS and VIIRS{through ? `, record through ${formatDate(through)}` : ""}.
        </span>
      </p>
    </div>
  );
}
