// A legend with real counts on it, so colour is never the only way to read a value.
import { rampStops, scaleValue } from "../../lib/colors";
import { formatCount } from "../../lib/format";
import type { Ramp } from "../../state/store";

type Props = { max: number; ramp: Ramp };

// 1, 10, 100, ... and the maximum itself.
function ticks(max: number): number[] {
  const values: number[] = [];
  for (let v = 1; v < max; v *= 10) values.push(v);
  // Drop a power of ten that would sit on top of the maximum's label.
  if (values.length > 1 && scaleValue(values[values.length - 1], max) > 0.75) values.pop();
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
  const stops = rampStops(ramp, 9);
  return (
    <div className="flex items-start gap-3 text-xs" style={{ color: "var(--text-dim)" }}>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="block h-3 w-5 rounded-sm"
          style={{ background: "var(--zero-cell)", border: "1px solid var(--border)" }}
        />
        <span>0</span>
      </div>
      <div className="flex-1">
        <div className="h-3 rounded-sm" style={{ background: `linear-gradient(to right, ${stops.join(", ")})` }} />
        <div className="relative h-4">
          {ticks(max).map((value) => {
            const t = scaleValue(value, max);
            return (
              <span
                key={value}
                className="absolute top-0.5"
                style={{ left: `${t * 100}%`, transform: `translateX(${t > 0.95 ? "-100%" : t < 0.05 ? "0" : "-50%"})` }}
              >
                {formatCount(value)}
              </span>
            );
          })}
        </div>
      </div>
      <span>hot spots per month (log scale)</span>
    </div>
  );
}
