// Colour ramps for the calendar, the map and the legends.
import { interpolateCividis, interpolateInferno } from "d3-scale-chromatic";
import type { Ramp } from "../state/store";

// The darkest part of both ramps vanishes on a dark page, so only this part is used.
const RAMP_START = 0.15;

const INTERPOLATORS: Record<Ramp, (t: number) => string> = {
  fire: interpolateInferno,
  cividis: interpolateCividis,
};

function clamp01(t: number): number {
  if (!(t > 0)) return 0; // also catches NaN
  return t > 1 ? 1 : t;
}

// 0 for value <= 0, else log1p(value) / log1p(max), within 0..1.
export function scaleValue(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return clamp01(Math.log1p(value) / Math.log1p(max));
}

// t in 0..1 -> a CSS colour. Exactly zero is not drawn with this: use var(--zero-cell).
export function rampColor(t: number, ramp: Ramp): string {
  return INTERPOLATORS[ramp](RAMP_START + (1 - RAMP_START) * clamp01(t));
}

// n evenly spaced colours from dark to light, for legends and map layers.
export function rampStops(ramp: Ramp, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [rampColor(1, ramp)];
  return Array.from({ length: n }, (_, i) => rampColor(i / (n - 1), ramp));
}
