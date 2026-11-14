import { useMemo } from "react";
import {
  FIRE_RED,
  HATCH_TILE_CSS,
  hatchCssBackground,
  hatchOpacity,
  levelOf,
  tintOpacity,
  valueAt,
} from "./fire";
import { formatCount } from "./labels";

type Props = {
  max: number; // the largest cell value in view
  step: number; // cell size in tenths of a degree
  period: string;
  loading: boolean;
  failed: boolean;
};

const STOPS = [0.15, 0.5, 0.8, 1];

// Bottom left of the map: what the red hatching means, with real counts.
export default function Legend({ max, step, period, loading, failed }: Props) {
  const backgrounds = useMemo(() => {
    const ratio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    return [0, 1, 2].map((level) => hatchCssBackground(level, ratio));
  }, []);

  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-3 z-10 w-64 rounded-md border border-[var(--border)] bg-[var(--panel)]/90 p-3 text-xs shadow-lg backdrop-blur"
      aria-label="Map legend"
      role="group"
    >
      <div className="mb-1 font-semibold text-[var(--text)]">Hot spots per cell</div>
      <div className="mb-2 text-[var(--text-dim)]">
        {period} · cells {step / 10}° wide, harmonized counts
      </div>
      {max > 0 ? (
        <ul className="flex items-end justify-between gap-2">
          {STOPS.map((t) => (
            <li key={t} className="flex flex-col items-center gap-1">
              <span
                aria-hidden="true"
                className="block h-7 w-11"
                style={{
                  border: `2px solid ${FIRE_RED}`,
                  backgroundColor: `rgba(255, 49, 49, ${tintOpacity(t)})`,
                  backgroundImage: backgrounds[levelOf(t)],
                  backgroundSize: HATCH_TILE_CSS,
                  opacity: Math.max(hatchOpacity(t), 0.6),
                }}
              />
              <span className="tabular-nums text-[var(--text)]">
                {t === 1 ? formatCount(max) : formatCount(valueAt(t, max))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--text-dim)]">{failed ? "Hot spots are unavailable right now." : loading ? "Loading hot spots…" : "No hot spots in this period."}</p>
      )}
      <div className="mt-2 text-[var(--text-dim)]">Hover a cell for its exact count.</div>
    </div>
  );
}
