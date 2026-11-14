// Compares one month with the same calendar month in the other years. Feature F4.
import { useCompare } from "../../api/hooks";
import { formatCount, formatMonthYear, monthName } from "../../lib/format";
import { useStore } from "../../state/store";
import { CompareChart } from "./CompareChart";
import { headline, ordinal, partialNote } from "./sentences";

// The downloads panel finds the chart's SVG inside the element with this id.
export const COMPARE_CHART_ID = "compare-chart";

function Key({ swatch, children }: { swatch: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-2.5 w-4" style={swatch} />
      {children}
    </span>
  );
}

export function ComparePanel() {
  const bbox = useStore((state) => state.bbox);
  const selected = useStore((state) => state.selected);
  // With nothing selected, leave year and month out and the API uses the latest complete month.
  const compare = useCompare(bbox, selected?.year, selected?.month);

  let body;
  if (!bbox) {
    body = <p style={{ color: "var(--text-dim)" }}>Pick an area on the map to compare a month with its history.</p>;
  } else if (compare.isError) {
    body = <p role="alert">Could not load the comparison: {compare.error.message}</p>;
  } else if (!compare.data) {
    body = <p style={{ color: "var(--text-dim)" }}>Loading the comparison…</p>;
  } else {
    const data = compare.data;
    const { target, baseline, difference } = data;
    const month = monthName(target.month);
    const partial = partialNote(data);
    const sentence = headline(data);
    body = (
      <div className="flex flex-col gap-2">
        <div aria-live="polite">
          {partial && (
            <p className="font-semibold" style={{ color: "var(--accent)" }}>
              {partial}
            </p>
          )}
          <p className="text-base font-semibold">{sentence}</p>
          <p style={{ color: "var(--text-dim)" }}>
            {baseline.max === 0 && target.harmonized === 0 ? (
              <>No hot spots in any {month} on record here.</>
            ) : (
              <>
                {formatCount(target.harmonized)} hot spots against a median of {formatCount(baseline.median)}. Usual
                range {formatCount(baseline.p25)} to {formatCount(baseline.p75)}.{" "}
                {difference.rank === 1 ? "Highest" : `${ordinal(difference.rank)} highest`} of {difference.of} {month}s:{" "}
                <span style={{ color: "var(--text)" }}>{difference.label}</span>.
              </>
            )}
          </p>
        </div>
        <div
          id={COMPARE_CHART_ID}
          role="img"
          aria-label={`Bar chart of ${month} hot spots by year, ${baseline.start_year} to ${baseline.end_year}. ${sentence}`}
        >
          <CompareChart data={data} />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
          <Key swatch={{ background: "var(--accent)" }}>{formatMonthYear(target.year, target.month)}</Key>
          <Key swatch={{ background: "var(--text-dim)", opacity: 0.55 }}>other years</Key>
          <Key swatch={{ height: 0, borderTop: "2px dashed var(--text)" }}>median</Key>
          <Key swatch={{ background: "var(--focus)", opacity: 0.3 }}>usual range (middle half of years)</Key>
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-2 text-sm">
      <h2 id="compare-heading" className="text-sm font-semibold">
        Compared with other years
      </h2>
      {body}
    </section>
  );
}
