// Yearly totals, harmonized against raw, with the trend sentence. MASTERSPEC.md section 13, item 1.
import { useMeta, useTrend } from "../../api/hooks";
import { formatCount } from "../../lib/format";
import { useStore } from "../../state/store";
import { TrendChart } from "./TrendChart";
import { trendSentence, trendYears } from "./sentences";

function Key({ swatch, children }: { swatch: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-0 w-4" style={swatch} />
      {children}
    </span>
  );
}

export function TrendPanel() {
  const bbox = useStore((state) => state.bbox);
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const meta = useMeta();
  const years = meta.data ? trendYears(meta.data, startYear, endYear) : null;
  // Wait for meta, so the request goes out once with the right years.
  const trend = useTrend(years ? bbox : null, years?.[0], years?.[1]);

  let body;
  if (!bbox) {
    body = <p style={{ color: "var(--text-dim)" }}>Pick an area on the map to see its yearly trend.</p>;
  } else if (meta.data && !years) {
    body = <p style={{ color: "var(--text-dim)" }}>Choose at least three full years to see a trend.</p>;
  } else if (trend.isError) {
    body = <p role="alert">Could not load the trend: {trend.error.message}</p>;
  } else if (!trend.data) {
    body = <p style={{ color: "var(--text-dim)" }}>Loading the trend…</p>;
  } else {
    const data = trend.data;
    const sentence = trendSentence(data);
    const fit = data.harmonized_trend;
    body = (
      <div className="flex flex-col gap-2">
        <p aria-live="polite">{sentence}</p>
        <div
          role="img"
          aria-label={`Line chart of yearly hot spots, harmonized and raw, ${data.start_year} to ${data.end_year}. ${sentence}`}
        >
          <TrendChart data={data} />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
          <Key swatch={{ borderTop: "2px solid var(--accent)" }}>harmonized (Suomi NPP scale)</Key>
          <Key swatch={{ borderTop: "2px dashed var(--text-dim)" }}>raw, as reported</Key>
        </p>
        <p className="text-xs tabular-nums" style={{ color: "var(--text-dim)" }}>
          Harmonized slope {formatCount(Math.round(fit.slope_per_year))} hot spots a year, p = {fit.p_value.toFixed(3)}.
          Full years only.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="trend-heading" className="flex flex-col gap-2 text-sm">
      <h2 id="trend-heading" className="text-sm font-semibold">
        Trend over the years
      </h2>
      {body}
    </section>
  );
}
