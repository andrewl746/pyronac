// Downloads: hot spots and calendar as CSV, calendar and comparison chart as PNG. Feature F5.
// Under the buttons, a note on the method the numbers come from.
import { useState } from "react";
import { api } from "../../api/client";
import { useMeta, usePointsCount } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { downloadSvgAsPng } from "../../lib/download";
import { formatCount, formatMonthYear } from "../../lib/format";
import { useStore } from "../../state/store";
import { CALENDAR_SVG_ID } from "../calendar/Calendar";
import { COMPARE_CHART_ID } from "../compare/ComparePanel";
import { MethodNote } from "./MethodNote";

const MAX_CSV_ROWS = 1_000_000; // the backend refuses a larger export

const pad = (n: number) => String(n).padStart(2, "0");

// (2026, 10) -> ["2026-10-01", "2026-10-31"]
function monthRange(year: number, month: number): [string, string] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(lastDay)}`];
}

const buttonClass = "btn";

function boxText(bbox: Bbox): string {
  return `Latitude ${bbox.south} to ${bbox.north}, longitude ${bbox.west} to ${bbox.east}`;
}

export function Downloads() {
  const bbox = useStore((state) => state.bbox);
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const mode = useStore((state) => state.mode);
  const selected = useStore((state) => state.selected);
  const meta = useMeta();

  // The dates default to the selected month, or the latest complete month.
  const lastComplete = meta.data?.last_complete_month; // "2026-10"
  const defaultMonth =
    selected ?? (lastComplete ? { year: Number(lastComplete.slice(0, 4)), month: Number(lastComplete.slice(5, 7)) } : null);
  const defaultKey = defaultMonth ? `${defaultMonth.year}-${defaultMonth.month}` : "";
  const [defaultStart, defaultEnd] = defaultMonth ? monthRange(defaultMonth.year, defaultMonth.month) : ["", ""];
  // What the user typed, kept only while the default it replaced is still the default.
  const [edited, setEdited] = useState({ key: "", start: "", end: "" });
  const start = edited.key === defaultKey ? edited.start : defaultStart;
  const end = edited.key === defaultKey ? edited.end : defaultEnd;

  const [pngError, setPngError] = useState<string | null>(null);

  const datesOk = start !== "" && end !== "" && start <= end;
  const count = usePointsCount(datesOk ? bbox : null, start, end);
  const rows = count.data?.count;
  const tooMany = rows !== undefined && rows > MAX_CSV_ROWS;

  async function savePng(svg: Element | null | undefined, filename: string, caption: string, missing: string) {
    setPngError(null);
    if (!(svg instanceof SVGSVGElement)) {
      setPngError(missing);
      return;
    }
    try {
      await downloadSvgAsPng(svg, filename, caption);
    } catch (error) {
      setPngError(error instanceof Error ? error.message : "The image could not be made.");
    }
  }

  let body;
  if (!bbox) {
    body = <p style={{ color: "var(--text-dim)" }}>Pick an area on the map to download its hot spots.</p>;
  } else {
    const comparedMonth = defaultMonth ? formatMonthYear(defaultMonth.year, defaultMonth.month) : "";
    body = (
      <div className="no-print flex flex-col gap-3">
        <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0 text-xs">
          <legend className="sr-only">Dates for the hot spot download</legend>
          <label className="flex items-center gap-1.5">
            <span style={{ color: "var(--text-dim)" }}>From</span>
            <input
              type="date"
              value={start}
              onChange={(event) => setEdited({ key: defaultKey, start: event.target.value, end })}
              className="field"
              style={{ colorScheme: "dark" }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: "var(--text-dim)" }}>to</span>
            <input
              type="date"
              value={end}
              onChange={(event) => setEdited({ key: defaultKey, start, end: event.target.value })}
              className="field"
              style={{ colorScheme: "dark" }}
            />
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          {datesOk && !tooMany ? (
            <a href={api.pointsCsvUrl(bbox, start, end)} download className={buttonClass}>
              Hot spots (CSV)
            </a>
          ) : (
            <span role="link" aria-disabled="true" className={buttonClass}>
              Hot spots (CSV)
            </span>
          )}
          <span className="text-[11px]" aria-live="polite" style={{ color: "var(--text-dim)" }}>
            {!datesOk
              ? "Choose a start date that is not after the end date."
              : count.isError
                ? `Could not count the rows: ${count.error.message}`
                : rows === undefined
                  ? "Counting rows…"
                  : tooMany
                    ? `${formatCount(rows)} rows is too many. Choose a smaller area or a shorter date range.`
                    : `${formatCount(rows)} ${rows === 1 ? "row" : "rows"}, as the satellites reported them`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={api.calendarCsvUrl(bbox, startYear, endYear)} download className={buttonClass}>
            Calendar (CSV)
          </a>
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              savePng(
                document.getElementById(CALENDAR_SVG_ID),
                `fire_calendar_${startYear}_${endYear}_${mode}.png`,
                `Pyronac fire calendar, ${mode} hot spots per month. ${boxText(bbox)}`,
                "Switch the calendar from Table back to the chart, then try again.",
              )
            }
          >
            Calendar (PNG)
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              savePng(
                document.getElementById(COMPARE_CHART_ID)?.querySelector("svg"),
                "fire_comparison.png",
                // The chart says what it shows: one month across the years, or the yearly totals.
                `Pyronac: ${document.getElementById(COMPARE_CHART_ID)?.dataset.caption ?? `${comparedMonth} against the same month in other years`}. ${boxText(bbox)}`,
                "The comparison chart is not on screen yet.",
              )
            }
          >
            Comparison chart (PNG)
          </button>
        </div>
        {pngError && (
          <p role="alert" className="text-xs">
            {pngError}
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="downloads-heading" className="flex flex-col gap-3 text-[13px]">
      <h2 id="downloads-heading" className="label">
        <span className="no-print">Downloads</span>
        <span className="print-only">Method</span>
      </h2>
      {body}
      {meta.data && (
        <MethodNote
          harmonization={meta.data.harmonization}
          eras={meta.data.eras}
          lastMonth={meta.data.last_month}
        />
      )}
    </section>
  );
}
