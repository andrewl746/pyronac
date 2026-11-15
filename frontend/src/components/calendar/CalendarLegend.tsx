// A legend with real counts on it, so colour is never the only way to read a value.
import { scaleValue } from "../../lib/colors";
import { fireFill } from "../map/fire";
import { formatCount } from "../../lib/format";
import type { Ramp } from "../../state/store";

type Props = { max: number; ramp: Ramp };

// 1, 10, 100, ... and the maximum itself, leaving out any that would sit on top of another label.
const MIN_GAP = 0.13; // between two labels, as a share of the bar
const MAX_GAP = 0.2; // room kept free for the maximum's own label

function ticks(max: number): number[] {
  const values: number[] = [];
  let last = -1;
  for (let v = 1; v < max; v *= 10) {
    const t = scaleValue(v, max);
    if (t - last < MIN_GAP || 1 - t < MAX_GAP) continue;
    values.push(v);
    last = t;
  }
  values.push(max);
  return values;
}

export function CalendarLegend({ max, ramp }: Props) {
  if (!(max > 0)) {
    return (
      <p className="text-xs" style={{ color: "var(--text-dim)" }}>
        No hot spots in this area and period.
      </p>
    );
  }
  const stops = Array.from({ length: 9 }, (_, i) => fireFill(i / 8, ramp));
  return (
    <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-dim)" }}>
      <span>Hot spots per month (log scale)</span>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="block h-1.5 w-5 rounded-full"
            style={{ background: "var(--zero-cell)", border: "1px solid var(--border)" }}
          />
          <span>0</span>
        </div>
        <div className="flex-1">
          <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(to right, ${stops.join(", ")})` }} />
          <div className="relative h-4">
            {ticks(max).map((value) => {
              const t = scaleValue(value, max);
              return (
                <span
                  key={value}
                  className="absolute top-0.5"
                  style={{
                    left: `${t * 100}%`,
                    transform: `translateX(${t > 0.95 ? "-100%" : t < 0.05 ? "0" : "-50%"})`,
                  }}
                >
                  {formatCount(value)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
