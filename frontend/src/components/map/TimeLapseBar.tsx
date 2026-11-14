import { useMeta } from "../../api/hooks";
import { formatMonthYear } from "../../lib/format";
import { ym } from "./labels";
import type { TimeLapse } from "./timeLapse";

type Props = {
  timeLapse: TimeLapse;
  enabled: boolean; // false in the anomaly view
};

const ERA_TINTS = ["rgba(255, 255, 255, 0.06)", "rgba(124, 196, 255, 0.14)", "rgba(255, 138, 61, 0.16)"];
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
      className="pointer-events-auto absolute right-14 bottom-3 left-[19.5rem] z-10 rounded-md border border-[var(--border)] bg-[var(--panel)]/90 px-3 py-2 text-xs shadow-lg backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={busy ? pause : () => void play()}
          disabled={!busy && (!enabled || n === 0)}
          title={enabled ? undefined : "Switch to Hot spots to play the time-lapse"}
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            busy
              ? "border-[var(--accent)] bg-[var(--accent)] text-black"
              : "border-[var(--border)] bg-[var(--panel-2)] text-[var(--text)] hover:bg-[var(--border)]"
          }`}
        >
          <span aria-hidden="true">{phase === "playing" ? "❚❚" : phase === "loading" ? "■" : "▶"}</span>
          {phase === "playing" ? "Pause" : phase === "loading" ? "Stop" : "Play"}
        </button>
        <div className="w-28 shrink-0 text-sm font-medium text-[var(--text)] tabular-nums">
          {phase === "loading" ? `Loading ${progress.done} of ${progress.total}` : current}
        </div>
        <div className="relative h-10 min-w-0 flex-1">
          {eras.map((era) => (
            <div
              key={era.id}
              title={era.label}
              aria-hidden="true"
              className="absolute top-0 bottom-0 overflow-hidden rounded-sm"
              style={{
                left: `${(era.from / n) * 100}%`,
                width: `${((era.to - era.from + 1) / n) * 100}%`,
                backgroundColor: ERA_TINTS[era.i % ERA_TINTS.length],
                borderLeft: era.from > 0 ? "2px solid var(--accent)" : undefined,
              }}
            >
              <span className="block truncate px-1.5 pt-0.5 text-[10px] leading-tight text-[var(--text-dim)]">
                {era.name}
                {era.from > 0 && <span className="text-[var(--accent)]"> · from {shortMonth(era.start)}</span>}
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
          className="mt-1.5 h-1 overflow-hidden rounded bg-[var(--border)]"
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
        <p role="alert" className="mt-1.5 text-[var(--accent)]">
          Could not load the months for the time-lapse: {error}
        </p>
      )}
    </div>
  );
}
