// Three or four sentences about the box, from fixed templates.
// Uses the same queries as the calendar, compare and trend panels, so it adds no requests of its own.
import { useCalendar, useCompare, useMeta, useTrend } from "../../api/hooks";
import { useStore } from "../../state/store";
import { headline } from "../compare/sentences";
import { trendYears } from "../trend/sentences";
import { busiestYear, peakMonth, summary, trendLine } from "./sentences";

export function Summary() {
  const bbox = useStore((state) => state.bbox);
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const selected = useStore((state) => state.selected);
  const meta = useMeta();
  const years = meta.data ? trendYears(meta.data, startYear, endYear) : null;

  const calendar = useCalendar(bbox, startYear, endYear);
  const compare = useCompare(bbox, selected?.year, selected?.month);
  const trend = useTrend(years ? bbox : null, years?.[0], years?.[1]);

  if (!bbox) return null;

  const waitingForTrend = Boolean(years) && !trend.data && !trend.isError;
  const loading = !calendar.data || !compare.data || waitingForTrend;

  let body;
  if (calendar.isError || compare.isError) {
    body = <p role="alert">Could not load the numbers for the summary.</p>;
  } else if (loading) {
    body = <p style={{ color: "var(--text-dim)" }}>Loading the summary…</p>;
  } else {
    const text = summary(
      [
        trend.data ? busiestYear(trend.data) : null,
        calendar.data ? peakMonth(calendar.data.months) : null,
        compare.data ? headline(compare.data) : null,
        trend.data ? trendLine(trend.data) : null,
      ],
      startYear,
      endYear,
    );
    body = (
      <p aria-live="polite" className="text-[14px] leading-relaxed text-[var(--text)]">
        {text}
      </p>
    );
  }

  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-2 text-[13px]">
      <h2 id="summary-heading" className="label">
        In plain words
      </h2>
      {body}
    </section>
  );
}
