import type { ReactNode } from "react";
import { formatCount } from "../../lib/format";
import { FIRE_RED, fireFill, valueAt } from "./fire";

type Props = {
  max: number; // the largest cell value in view
  step: number; // cell size in tenths of a degree
  period: string;
  loading: boolean;
  failed: boolean;
  note?: string; // for example why the scale is fixed during the time-lapse
  children?: ReactNode; // the month picker
};

// Where the counts are written along the gradient, evenly spaced so the labels never crowd.
const STOPS = [0.1, 0.4, 0.7, 1];

// Legend stops fall between real counts, so show whole numbers once they reach 10.
function stopLabel(value: number): string {
  return formatCount(value >= 10 ? Math.round(value) : value);
}

// The gradient as the map draws it, left (fewest hot spots) to right (most).
const GRADIENT_CSS = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(fireFill).join(", ")})`;

// Bottom left of the map: which month is shown, and what the red gradient means, with real counts.
export default function Legend({ max, step, period, loading, failed, note, children }: Props) {
  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-3 z-10 w-64 rounded-md border border-[var(--border)] bg-[var(--panel)]/90 p-3 text-xs shadow-lg backdrop-blur"
      aria-label="Map legend"
      role="group"
    >
      <div className="mb-1.5 font-semibold text-[var(--text)]">Hot spots per cell</div>
      {children}
      <div className="mb-2 text-[var(--text-dim)]">
        {period} · cells {step / 10}° wide, harmonized counts
        {note && <span className="mt-1 block text-[var(--accent)]">{note}</span>}
      </div>
      {max > 0 ? (
        <div>
          <div
            aria-hidden="true"
            className="h-4 w-full rounded-sm border border-[var(--border)]"
            style={{ backgroundImage: GRADIENT_CSS }}
          />
          <ul className="relative mt-1 h-4" aria-label="Hot spots per cell along the gradient">
            {STOPS.map((t) => (
              <li
                key={t}
                className="absolute top-0 tabular-nums text-[var(--text)]"
                style={{ left: `${t * 100}%`, transform: `translateX(${t === 1 ? "-100%" : "-50%"})` }}
              >
                {t === 1 ? formatCount(max) : stopLabel(valueAt(t, max))}
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-[10px] text-[var(--text-dim)]" aria-hidden="true">
            <span>fewer</span>
            <span>more</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[var(--text-dim)]">
            <span aria-hidden="true" className="block h-3 w-5 rounded-sm" style={{ border: `2px solid ${FIRE_RED}` }} />
            Outline: one connected burning area
          </div>
        </div>
      ) : (
        <p className="text-[var(--text-dim)]">{failed ? "Hot spots are unavailable right now." : loading ? "Loading hot spots…" : "No hot spots in this period."}</p>
      )}
      <div className="mt-2 text-[var(--text-dim)]">Hover a cell for its exact count.</div>
    </div>
  );
}
