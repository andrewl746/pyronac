// The fire calendar panel: months by years for the selected box. Feature F2.
import { useState } from "react";
import { useCalendar, useMeta } from "../../api/hooks";
import type { Era } from "../../api/types";
import { useStore } from "../../state/store";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarLegend } from "./CalendarLegend";
import { CalendarTable } from "./CalendarTable";
import { estimateFrom } from "./estimate";

// The downloads panel finds the calendar SVG by this id.
export const CALENDAR_SVG_ID = "fire-calendar-svg";

export function Calendar() {
  const bbox = useStore((state) => state.bbox);
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const mode = useStore((state) => state.mode);
  const ramp = useStore((state) => state.ramp);
  const selected = useStore((state) => state.selected);
  const setSelected = useStore((state) => state.setSelected);
  const [showTable, setShowTable] = useState(false);

  const calendar = useCalendar(bbox, startYear, endYear);
  const meta = useMeta();

  const eraLabels: Partial<Record<Era, string>> = {};
  for (const era of meta.data?.eras ?? []) eraLabels[era.id] = era.label;

  let body;
  if (!bbox) {
    body = <p style={{ color: "var(--text-dim)" }}>Pick an area on the map to see its fire calendar.</p>;
  } else if (calendar.isError) {
    body = <p role="alert">Could not load the calendar: {calendar.error.message}</p>;
  } else if (!calendar.data) {
    body = <p style={{ color: "var(--text-dim)" }}>Loading the calendar…</p>;
  } else {
    const data = calendar.data;
    const max = mode === "harmonized" ? data.max_harmonized : data.max_raw;
    body = showTable ? (
      <CalendarTable months={data.months} mode={mode} />
    ) : (
      <div className="flex flex-col gap-2">
        <CalendarGrid
          months={data.months}
          mode={mode}
          max={max}
          ramp={ramp}
          selected={selected}
          onSelect={setSelected}
          eraLabels={eraLabels}
          estimate={estimateFrom(meta.data)}
          svgId={CALENDAR_SVG_ID}
        />
        <CalendarLegend max={max} ramp={ramp} />
      </div>
    );
  }

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <h2 id="calendar-heading" className="text-sm font-semibold">
          Fire calendar <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({mode})</span>
        </h2>
        {bbox && (
          <button
            type="button"
            aria-pressed={showTable}
            onClick={() => setShowTable((value) => !value)}
            className="no-print cursor-pointer rounded border px-2 py-0.5 text-xs"
            style={{
              borderColor: "var(--border)",
              background: showTable ? "var(--panel-2)" : "transparent",
              color: "var(--text)",
            }}
          >
            Table
          </button>
        )}
      </div>
      {body}
    </section>
  );
}
