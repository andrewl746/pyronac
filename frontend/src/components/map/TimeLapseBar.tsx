import { useMeta } from "../../api/hooks";
import { formatMonthYear } from "../../lib/format";
import { ym } from "./labels";
import type { TimeLapse } from "./timeLapse";

type Props = {
  timeLapse: TimeLapse;
  enabled: boolean; // false in the anomaly view
};

const ERA_TINTS = ["transparent", "transparent", "transparent"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2012-02" -> "Feb 2012"
function shortMonth(text: string): string {
  const [year, month] = text.split("-").map(Number);
  return `${SHORT_MONTHS[month - 1] ?? ""} ${year}`;
}

// Bottom of the map: Play or Pause, the current month, and a timeline of the year range with the
// three eras shaded and a marker at each handoff between satellites.
export default function TimeLapseBar({ timeLapse, enabled }: Props) {
  const meta = useMeta();
  const { months, index, phase, progress, error, play, pause, scrubTo } = timeLapse;
  const n = months.length;
  const keys = months.map((m) => ym(m.year, m.month));

  // Where each era sits on the timeline, from /api/meta.
  const eras = (meta.data?.eras ?? []).flatMap((era, i) => {
    const from = keys.findIndex((k) => k >= era.from);
    if (from < 0) return [];
    const after = era.to === null ? -1 : keys.findIndex((k) => k > (era.to ?? ""));
    const to = after < 0 ? n - 1 : after - 1;
    if (to < from) return [];
    return [{ id: era.id, i, from, to, name: era.label.split(",")[0], label: era.label, start: era.from }];
  });

  const current = index >= 0 ? formatMonthYear(months[index].year, months[index].month) : "Whole period";
  const busy = phase !== "idle";

  return (
    <div
      role="group"
      aria-label="Time-lapse"
      className="map-panel absolute bottom-8 left-1/2 z-10 w-[min(520px,calc(100%-560px))] min-w-[360px] -translate-x-1/2 py-1.5 pr-5 pl-1.5 text-xs"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={busy ? pause : () => void play()}
          disabled={!busy && (!enabled || n === 0)}
          title={enabled ? undefined : "Switch to Hot spots to play the time-lapse"}
          aria-label={phase === "playing" ? "Pause" : phase === "loading" ? "Stop" : "Play the time-lapse"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center text-[var(--text)] transition-colors disabled:opacity-40 ${
            busy ? "bg-[var(--glass-active)]" : "bg-[var(--glass-hover)] hover:bg-[var(--glass-active)]"
          }`}
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            {phase === "playing" ? (
              <path d="M3 2h2v8H3zM7 2h2v8H7z" />
            ) : phase === "loading" ? (
              <path d="M3 3h6v6H3z" />
            ) : (
              <path d="M3.5 2.2v7.6L9.8 6z" />
            )}
          </svg>
        </button>
        <div className="w-[104px] shrink-0 text-[12.5px] text-[var(--text)] tabular-nums">
          {phase === "loading" ? `Loading ${progress.done} of ${progress.total}` : current}
        </div>
        <div className="relative h-7 min-w-0 flex-1">
          {eras.map((era) => (
            <div
              key={era.id}
              title={era.label}
              aria-hidden="true"
              className="absolute top-0 bottom-0 overflow-hidden"
              style={{
                left: `${(era.from / n) * 100}%`,
                width: `${((era.to - era.from + 1) / n) * 100}%`,
                backgroundColor: ERA_TINTS[era.i % ERA_TINTS.length],
                borderLeft: era.from > 0 ? "1px solid rgba(255, 255, 255, 0.18)" : undefined,
              }}
            >
              <span className="block truncate px-1.5 text-[9.5px] leading-tight text-[var(--text-faint)]">
                {era.name}
                {era.from > 0 && <span className="text-[var(--text-faint)]"> · from {shortMonth(era.start)}</span>}
              </span>
            </div>
          ))}
          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            step={1}
            value={Math.max(0, index)}
            disabled={n === 0 || phase === "loading"}
            onChange={(e) => scrubTo(Number(e.target.value))}
            aria-label="Month"
            aria-valuetext={current}
            className={`pyronac-timeline absolute inset-x-0 bottom-0 w-full ${index < 0 ? "is-unset" : ""}`}
          />
        </div>
      </div>
      {phase === "loading" && (
        <div
          className="mt-1.5 h-px overflow-hidden bg-[var(--border)]"
          role="progressbar"
          aria-label="Loading the months"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div
            className="h-full bg-[var(--accent)]"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[var(--warn)]">
          Could not load the months for the time-lapse: {error}
        </p>
      )}
    </div>
  );
}
