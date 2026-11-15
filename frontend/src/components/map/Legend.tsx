import type { ReactNode } from "react";
import { formatCompact, formatCount } from "../../lib/format";
import { useStore } from "../../state/store";
import { fireFill, valueAt } from "./fire";

type Props = {
  max: number; // the largest cell value in view
  step: number; // cell size in tenths of a degree
  period: string;
  loading: boolean;
  failed: boolean;
  note?: string; // for example why the scale is fixed during the time-lapse
  children?: ReactNode; // the month picker
};

// Where the counts are written along the gradient, evenly spaced and in short form so the labels
// never crowd. The last is aligned to the end of the bar.
const STOPS = [0.1, 0.4, 0.7, 1];

// Legend stops fall between real counts, so show whole numbers once they reach 10, and short
// forms (9.9K) once they reach 1,000.
function stopLabel(value: number): string {
  if (value >= 1000) return formatCompact(value);
  return formatCount(value >= 10 ? Math.round(value) : Math.round(value * 10) / 10);
}

// Bottom left of the map: which month is shown, and what the colours mean, with real counts.
export default function Legend({ max, step, period, loading, failed, note, children }: Props) {
  const ramp = useStore((s) => s.ramp);
  const gradient = `linear-gradient(to right, ${[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
    .map((t) => fireFill(t, ramp))
    .join(", ")})`;

  return (
    <div className="map-panel map-legend" aria-label="Map legend" role="group">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-[var(--text)]">Hot spots per cell</span>
        <span className="text-[10.5px] text-[var(--text-faint)]">log scale</span>
      </div>
      {children}
      {max > 0 ? (
        <div>
          <div aria-hidden="true" className="h-1.5 w-full rounded-full" style={{ backgroundImage: gradient }} />
          <ul className="relative mt-1.5 h-4 text-[11px]" aria-label="Hot spots per cell along the colour scale">
            {STOPS.map((t, i) => (
              <li
                key={t}
                className="absolute top-0 tabular-nums text-[var(--text-dim)]"
                style={{
                  left: `${t * 100}%`,
                  transform: `translateX(${i === STOPS.length - 1 ? "-100%" : "-50%"})`,
                }}
                title={formatCount(t === 1 ? max : Math.round(valueAt(t, max) * 10) / 10)}
              >
                <span aria-hidden="true">{stopLabel(t === 1 ? max : valueAt(t, max))}</span>
                <span className="sr-only">{formatCount(t === 1 ? max : Math.round(valueAt(t, max) * 10) / 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-dim)]">
          {failed ? "Hot spots are unavailable right now." : loading ? "Loading hot spots…" : "No hot spots in this period."}
        </p>
      )}
      <div className="mt-1.5 text-[10.5px] leading-snug text-[var(--text-faint)]">
        {period} · {step / 10}° cells
        {note && <span className="mt-1 block text-[var(--text-dim)]">{note}</span>}
      </div>
    </div>
  );
}
