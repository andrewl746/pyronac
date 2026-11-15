import { useState } from "react";
import { useMeta } from "../api/hooks";
import { useStore } from "../state/store";
import { BriefingHeader } from "./BriefingHeader";
import { Calendar } from "./calendar/Calendar";
import { ComparePanel } from "./compare/ComparePanel";
import { MethodNote } from "./downloads/MethodNote";
import { usePresetName } from "./region/presetName";
import { Summary } from "./summary/Summary";

// The insights for the selected area, in a glass panel that slides in from the right. Nothing shows
// while no area is selected. Order: the plain-words summary, the fire calendar, the comparison
// with other years. Downloads, the years and the method note are in the menu (Menu.tsx).
// Printing the page gives this panel as a one-page briefing: see the print rules in theme.css.
export default function Sidebar() {
  const bbox = useStore((s) => s.bbox);
  const meta = useMeta();
  const name = usePresetName();
  // Dismissed for one box only: a new box opens the panel again.
  const [closedFor, setClosedFor] = useState<typeof bbox>(null);
  const open = bbox !== null && closedFor !== bbox;

  if (!bbox) return null;

  const where = `Latitude ${bbox.south}° to ${bbox.north}°, longitude ${bbox.west}° to ${bbox.east}°`;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setClosedFor(null)}
          className="glass map-btn no-print fixed top-[72px] right-5 z-20 h-9 px-4"
        >
          Show insights
        </button>
      )}
      <aside
        aria-label="Insights"
        aria-hidden={!open}
        inert={!open}
        className="glass sheet-in fixed top-[72px] right-5 bottom-9 z-20 flex w-[min(420px,calc(100vw-40px))] flex-col overflow-hidden transition-[transform,opacity] duration-300 ease-out"
        style={{ transform: open ? "none" : "translateX(calc(100% + 40px))", opacity: open ? 1 : 0 }}
      >
        <div className="no-print flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[15px] font-medium">{name ?? "Custom area"}</h2>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--text-faint)] tabular-nums">{where}</p>
          </div>
          <button type="button" aria-label="Close insights" onClick={() => setClosedFor(bbox)} className="icon-btn -mt-1 -mr-2">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="briefing sheet-sections min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <BriefingHeader />
          <Summary />
          <Calendar />
          <ComparePanel />
          {meta.data && (
            <div className="print-only">
              <MethodNote harmonization={meta.data.harmonization} eras={meta.data.eras} lastMonth={meta.data.last_month} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
