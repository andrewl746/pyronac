// Compares the years with each other, as a compact bar chart over the From-To year range. Feature F4.
// It follows the map's Month/Year picker (the selected month):
// - a month picked: one bar per year for that calendar month, from /api/compare, with the picked
//   year highlighted, the median and the usual range;
// - "Whole period": one bar per year for the year's total, from the calendar's data, with the
//   busiest year highlighted. These follow the Harmonized or Raw switch, like the calendar.
import { useCalendar, useCompare, useMeta } from "../../api/hooks";
import type { CalendarMonth } from "../../api/types";
import { formatCount, formatMonthYear, monthName } from "../../lib/format";
import { useStore } from "../../state/store";
import { estimateFrom, estimateRange, isEstimated } from "../calendar/estimate";
import { CompareChart, type CompareRow } from "./CompareChart";
import { headline, partialNote } from "./sentences";

// The downloads panel finds the chart's SVG inside the element with this id, and its caption in
// the element's data-caption.
export const COMPARE_CHART_ID = "compare-chart";

function Key({ swatch, children }: { swatch: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-2 w-3" style={swatch} />
      {children}
    </span>
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// One row per year with the year's total. A year with a month still to come is partial.
function yearlyRows(months: CalendarMonth[], raw: boolean): CompareRow[] {
  const byYear = new Map<number, { value: number; months: number; complete: boolean }>();
  for (const m of months) {
    const year = byYear.get(m.year) ?? { value: 0, months: 0, complete: true };
    year.value += raw ? m.raw : m.harmonized;
    year.months += 1;
    year.complete &&= m.complete;
    byYear.set(m.year, year);
  }
  const rows = [...byYear.entries()].map(([year, y]) => ({
    year,
    value: Math.round(y.value * 10) / 10,
    highlight: false,
    partial: y.months < 12 || !y.complete,
  }));
  const busiest = rows.filter((r) => !r.partial).reduce<CompareRow | null>((a, r) => (!a || r.value > a.value ? r : a), null);
  return rows.map((r) => (r === busiest ? { ...r, highlight: true } : r));
}

export function ComparePanel() {
  const bbox = useStore((state) => state.bbox);
  const selected = useStore((state) => state.selected);
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const mode = useStore((state) => state.mode);
  const estimate = estimateFrom(useMeta().data);
  // A month picked: that month in every year of the range. Otherwise the yearly totals, from the
  // same query as the calendar, so no extra request.
  const compare = useCompare(selected ? bbox : null, selected?.year, selected?.month, startYear, endYear);
  const calendar = useCalendar(bbox, startYear, endYear);

  let body;
  if (!bbox) {
    body = <p style={{ color: "var(--text-dim)" }}>Pick an area on the map to compare the years.</p>;
  } else if (selected) {
    if (compare.isError) {
      body = <p role="alert">Could not load the comparison: {compare.error.message}</p>;
    } else if (!compare.data) {
      body = <p style={{ color: "var(--text-dim)" }}>Loading the comparison…</p>;
    } else {
      const data = compare.data;
      const { target, baseline } = data;
      const month = monthName(target.month);
      const when = formatMonthYear(target.year, target.month);
      const partial = partialNote(data);
      const sentence = headline(data);
      const rows: CompareRow[] = [
        ...data.history.map((h) => ({ year: h.year, value: h.harmonized, highlight: false })),
        { year: target.year, value: target.harmonized, highlight: true, partial: !target.complete },
      ]
        .sort((a, b) => a.year - b.year)
        .map((row) => {
          if (!(row.value > 0) || !isEstimated(estimate, row.year, target.month)) return row;
          const { low, high } = estimateRange(row.value, estimate.error);
          return { ...row, spread: [row.value - low, high - row.value] as [number, number] };
        });
      body = (
        <Chart
          sentence={partial ? `${partial} ${sentence}` : sentence}
          caption={`${when} against the same month in other years`}
          label={`Bar chart of ${month} hot spots by year, ${baseline.start_year} to ${baseline.end_year}. ${sentence}`}
          rows={rows}
          median={baseline.median}
          band={[baseline.p25, baseline.p75]}
          rowLabel={(row) => formatMonthYear(row.year, target.month)}
          highlightLabel={when}
          others={`other ${month}s`}
        />
      );
    }
  } else if (calendar.isError) {
    body = <p role="alert">Could not load the yearly totals: {calendar.error.message}</p>;
  } else if (!calendar.data) {
    body = <p style={{ color: "var(--text-dim)" }}>Loading the yearly totals…</p>;
  } else {
    const raw = mode === "raw";
    const rows = yearlyRows(calendar.data.months, raw);
    const busiest = rows.find((r) => r.highlight);
    const first = rows[0]?.year;
    const last = rows[rows.length - 1]?.year;
    const counts = raw ? "raw counts, as the satellites reported them" : "harmonized counts";
    const sentence = busiest
      ? `Busiest year: ${busiest.year}, with ${formatCount(busiest.value)} hot spots (${counts}).`
      : `No full year in ${first} to ${last} yet.`;
    body = (
      <Chart
        sentence={sentence}
        caption={`Yearly hot spots, ${first} to ${last}, ${counts}`}
        label={`Bar chart of yearly hot spots, ${first} to ${last}. ${sentence}`}
        rows={rows}
        median={median(rows.filter((r) => !r.partial).map((r) => r.value))}
        rowLabel={(row) => String(row.year)}
        highlightLabel={busiest ? `${busiest.year}, the busiest year` : "busiest year"}
        others="other years"
      />
    );
  }

  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-3 text-[13px]">
      <h2 id="compare-heading" className="label">
        Compared with other years
      </h2>
      {body}
    </section>
  );
}

type ChartProps = {
  sentence: string; // the text alternative to the chart
  caption: string; // for the PNG download
  label: string;
  rows: CompareRow[];
  median: number | null;
  band?: [number, number];
  rowLabel: (row: CompareRow) => string;
  highlightLabel: string;
  others: string;
};

function Chart({ sentence, caption, label, rows, median, band, rowLabel, highlightLabel, others }: ChartProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] leading-snug text-[var(--text)]" aria-live="polite">
        {sentence}
      </p>
      <div id={COMPARE_CHART_ID} data-caption={caption} role="img" aria-label={label}>
        <CompareChart rows={rows} median={median} band={band} rowLabel={rowLabel} />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
        <Key swatch={{ background: "var(--accent)" }}>{highlightLabel}</Key>
        <Key swatch={{ background: "var(--text-dim)", opacity: 0.4 }}>{others}</Key>
        {median !== null && <Key swatch={{ height: 0, borderTop: "1px dashed var(--text)" }}>median</Key>}
        {band && <Key swatch={{ background: "var(--text)", opacity: 0.12 }}>usual range</Key>}
      </p>
    </div>
  );
}
