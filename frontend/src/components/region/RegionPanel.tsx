import { useState, type FormEvent } from "react";
import { useMeta } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { snapBbox } from "../../lib/geo";
import { useStore } from "../../state/store";

// MASTERSPEC.md section 8, region panel: presets, four edges with Apply, and Clear.
// The inputs always show the current box, including one drawn on the map.

type Edge = keyof Bbox;
type Draft = Record<Edge, string>;

const FIELDS: { edge: Edge; label: string; min: number; max: number }[] = [
  { edge: "north", label: "North", min: -90, max: 90 },
  { edge: "south", label: "South", min: -90, max: 90 },
  { edge: "west", label: "West", min: -180, max: 180 },
  { edge: "east", label: "East", min: -180, max: 180 },
];

function toDraft(bbox: Bbox | null): Draft {
  if (!bbox) return { north: "", south: "", west: "", east: "" };
  return {
    north: String(bbox.north),
    south: String(bbox.south),
    west: String(bbox.west),
    east: String(bbox.east),
  };
}

function sameBox(a: Bbox | null, b: Bbox): boolean {
  return !!a && a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north;
}

// Returns a sentence a user can read, or null when the box is fine.
function problemWith(draft: Draft): string | null {
  for (const { edge, label, min, max } of FIELDS) {
    const text = draft[edge].trim();
    const value = Number(text);
    if (text === "" || !Number.isFinite(value)) return `Enter a number for ${label.toLowerCase()}.`;
    if (value < min || value > max) return `${label} must be between ${min} and ${max}.`;
  }
  if (Number(draft.south) >= Number(draft.north)) return "South must be below north.";
  if (Number(draft.west) >= Number(draft.east)) return "West must be below east.";
  return null;
}

export default function RegionPanel() {
  const bbox = useStore((s) => s.bbox);
  const setBbox = useStore((s) => s.setBbox);
  const meta = useMeta();

  const [draft, setDraft] = useState<Draft>(() => toDraft(bbox));
  const [problem, setProblem] = useState<string | null>(null);
  // When the box changes anywhere else (map, preset, Clear), show it in the inputs.
  const [shownBox, setShownBox] = useState(bbox);
  if (shownBox !== bbox) {
    setShownBox(bbox);
    setDraft(toDraft(bbox));
    setProblem(null);
  }

  function apply(e: FormEvent) {
    e.preventDefault();
    const issue = problemWith(draft);
    setProblem(issue);
    if (issue) return;
    setBbox(
      snapBbox({
        west: Number(draft.west),
        south: Number(draft.south),
        east: Number(draft.east),
        north: Number(draft.north),
      }),
    );
  }

  return (
    <section aria-labelledby="region-heading" className="flex flex-col gap-3">
      <h2 id="region-heading" className="text-sm font-semibold tracking-wide text-[var(--text)] uppercase">
        Region
      </h2>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Preset areas">
        {meta.isPending && <span className="text-sm text-[var(--text-dim)]">Loading areas…</span>}
        {meta.isError && <span className="text-sm text-[var(--text-dim)]">Could not load the preset areas.</span>}
        {meta.data?.presets.map((preset) => {
          const box = snapBbox(preset.bbox);
          const active = sameBox(bbox, box);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => setBbox(box)}
              className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--panel-2)] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      <form onSubmit={apply} noValidate className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(({ edge, label, min, max }) => (
            <label key={edge} className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
              {label} <span className="sr-only">edge in degrees</span>
              <input
                type="number"
                inputMode="decimal"
                step={0.1}
                min={min}
                max={max}
                value={draft[edge]}
                placeholder="degrees"
                onChange={(e) => setDraft((d) => ({ ...d, [edge]: e.target.value }))}
                aria-invalid={problem !== null}
                aria-describedby={problem ? "region-problem" : undefined}
                className="tabular-nums rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)]/60"
              />
            </label>
          ))}
        </div>
        <p id="region-problem" role="alert" className="min-h-5 text-sm text-[var(--accent)]">
          {problem}
        </p>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black hover:brightness-110"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setBbox(null)}
            disabled={bbox === null}
            className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </form>
    </section>
  );
}
