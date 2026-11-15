import { ANOMALY_CLASSES, sentenceCase } from "./anomaly";

type Props = {
  monthLabel: string | null; // "October 2026", null until /api/meta has loaded
  partial: boolean; // the month is not complete yet
  hasBox: boolean;
  loading: boolean;
  failed: boolean;
};

// Bottom left of the map in anomaly view: what each colour means, in the compare panel's words.
export default function AnomalyLegend({ monthLabel, partial, hasBox, loading, failed }: Props) {
  const month = monthLabel?.split(" ")[0] ?? "month";
  return (
    <div
      className="map-panel map-legend"
      aria-label="Anomaly legend"
      role="group"
    >
      <div className="mb-1 text-[12px] font-medium text-[var(--text)]">How unusual was {monthLabel ?? "this month"}?</div>
      <div className="mb-2.5 text-[10.5px] leading-snug text-[var(--text-faint)]">
        Each cell against every other {month} since 2003{partial ? ". This month is not complete yet." : "."}
      </div>
      <div className="mb-1 flex justify-end text-[10px] text-[var(--text-faint)]" aria-hidden="true">
        percentile
      </div>
      <ul className="flex flex-col gap-1 text-[11px]">
        {[...ANOMALY_CLASSES].reverse().map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-[var(--text)]">
            <span
              aria-hidden="true"
              className="block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: c.color, opacity: c.opacity }}
            />
            <span className="flex-1">{sentenceCase(c.label)}</span>
            <span className="tabular-nums text-[var(--text-dim)]">
              {c.range}
              <span className="sr-only"> percentile</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[11px] text-[var(--text-faint)]">
        {failed
          ? "The anomaly data is unavailable right now."
          : !hasBox
            ? "Pick an area on the map to compare."
            : loading
              ? "Loading…"
              : "Hover a cell for its numbers."}
      </div>
    </div>
  );
}
