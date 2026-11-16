import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMeta } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { snapBbox } from "../../lib/geo";
import { useStore } from "../../state/store";
import { sameBox, usePresetName } from "./presetName";

// The region panel: presets, four edges with Apply, and Clear. Shown as a glass
// dropdown over the globe: the presets, Whole globe (clears the box), Draw area, and Custom… which
// opens the four edges. The inputs always show the current box, including one drawn on the map.

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

type Props = {
  drawing: boolean;
  onDraw: () => void; // turns draw mode on or off
  disabled: boolean; // until the map is ready
  onWholeGlobe: () => void; // flies back to the whole globe
};

export default function RegionPanel({ drawing, onDraw, disabled, onWholeGlobe }: Props) {
  const bbox = useStore((s) => s.bbox);
  const setBbox = useStore((s) => s.setBbox);
  const meta = useMeta();
  const presetName = usePresetName();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<Draft>(() => toDraft(bbox));
  const [problem, setProblem] = useState<string | null>(null);
  // When the box changes anywhere else (map, preset, Clear), show it in the inputs.
  const [shownBox, setShownBox] = useState(bbox);
  if (shownBox !== bbox) {
    setShownBox(bbox);
    setDraft(toDraft(bbox));
    setProblem(null);
  }

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

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
    setOpen(false);
  }

  const current = drawing ? "Drawing…" : bbox ? (presetName ?? "Custom area") : "Whole globe";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="region-menu"
        disabled={disabled}
        onClick={() => (drawing ? onDraw() : setOpen((o) => !o))}
        className="map-btn"
      >
        <span className="text-[var(--text-faint)]">Region</span>
        <span className="max-w-[180px] truncate text-[var(--text)]">{drawing ? "Cancel drawing" : current}</span>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="text-[var(--text-faint)]">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <section
          id="region-menu"
          aria-label="Region"
          className="map-panel absolute top-[calc(100%+10px)] left-1/2 z-20 w-[300px] -translate-x-1/2 p-1.5"
          style={{ background: "var(--glass-bg-strong)" }}
        >
          <div role="group" aria-label="Preset areas" className="flex flex-col">
            {meta.isPending && <span className="px-3 py-2 text-[12px] text-[var(--text-dim)]">Loading areas…</span>}
            {meta.isError && (
              <span className="px-3 py-2 text-[12px] text-[var(--text-dim)]">Could not load the preset areas.</span>
            )}
            <button
              type="button"
              aria-pressed={bbox === null}
              onClick={() => {
                // With a box, clearing it flies back to the globe (MapView); without one, fly here.
                if (bbox === null) onWholeGlobe();
                setBbox(null);
                setOpen(false);
              }}
              className="menu-item"
            >
              Whole globe
            </button>
            {meta.data?.presets.map((preset) => {
              const box = snapBbox(preset.bbox);
              const active = sameBox(bbox, box);
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setBbox(box);
                    setOpen(false);
                  }}
                  className="menu-item"
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
          <div className="mx-2 my-1.5 h-px bg-[var(--glass-border)]" aria-hidden="true" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDraw();
            }}
            className="menu-item"
          >
            Draw an area on the globe
          </button>
          <button type="button" aria-expanded={custom} onClick={() => setCustom((c) => !c)} className="menu-item">
            Custom…
          </button>

          {custom && (
            <form onSubmit={apply} noValidate className="flex flex-col gap-1.5 px-2 pt-1 pb-2">
              <div className="grid grid-cols-4 gap-1.5">
                {FIELDS.map(({ edge, label, min, max }) => (
                  <label key={edge} className="flex min-w-0 flex-col gap-1 text-[10.5px] text-[var(--text-dim)]">
                    {label} <span className="sr-only">edge in degrees</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      min={min}
                      max={max}
                      value={draft[edge]}
                      placeholder="deg"
                      onChange={(e) => setDraft((d) => ({ ...d, [edge]: e.target.value }))}
                      aria-invalid={problem !== null}
                      aria-describedby={problem ? "region-problem" : undefined}
                      className="field w-full placeholder:text-[var(--text-faint)]"
                    />
                  </label>
                ))}
              </div>
              <p id="region-problem" role="alert" className="min-h-4 text-[11px] text-[var(--warn)]">
                {problem}
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setBbox(null)} disabled={bbox === null} className="btn">
                  Clear
                </button>
                <button type="submit" className="btn btn-primary">
                  Apply
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
