import { useEffect, useRef } from "react";

// The sky behind the globe: a still field of faint stars, drawn once per size on a canvas. The map
// canvas is transparent around the globe, so these show through. Decoration only.

// A small seeded random generator, so the stars stay in the same places on every redraw.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(canvas: HTMLCanvasElement) {
  const { clientWidth: w, clientHeight: h } = canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const random = mulberry32(20261114);
  // About one star per 1,400 square pixels; most are barely there, a few are brighter.
  const count = Math.round((w * h) / 1400);
  for (let i = 0; i < count; i++) {
    const x = random() * w;
    const y = random() * h;
    const r = random();
    const brightness = r ** 3; // heavily skewed to faint
    const radius = 0.35 + brightness * 0.85;
    const alpha = 0.18 + brightness * 0.7;
    // A slight colour temperature spread: bluish to warm white.
    const tint = random();
    const color = tint < 0.2 ? "200, 215, 255" : tint > 0.9 ? "255, 236, 214" : "232, 236, 245";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
    ctx.fill();
  }
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    draw(canvas);
    const observer = new ResizeObserver(() => draw(canvas));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pyronac-stars" />;
}
