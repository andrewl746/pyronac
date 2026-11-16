import { pointVerb } from "../../lib/layout";
import { change } from "../trend/sentences";
import { signedCount, TREND_COLORS, TREND_OPACITY, type TrendMap } from "./trend";

type Props = { trendMap: TrendMap; hasBox: boolean };

// Bottom left of the map in the trend view: what each colour means, with real numbers, and, with a
// box selected, the whole box's trend harmonized against raw.
export default function TrendLegend({ trendMap, hasBox }: Props) {
  const { years, enough, done, total, error, trends, breaks, boxTrend } = trendMap;
  const from = years[0];
  const to = years[years.length - 1];
  const slopes = trends?.map((t) => t.slope) ?? [];
  const min = slopes.length ? Math.min(...slopes) : 0;
  const max = slopes.length ? Math.max(...slopes) : 0;
  // The range of slopes in each class, darkest (highest) first.
  const rows = TREND_COLORS.map((color, i) => ({
    color,
    opacity: TREND_OPACITY[i],
    low: i === 0 ? min : breaks[i - 1],
    high: i === TREND_COLORS.length - 1 ? max : breaks[i],
  })).reverse();

  let status: string | null = null;
  if (!enough) status = "Pick at least three full years to see a trend.";
  else if (error) status = `The trend is unavailable right now: ${error.message}`;
  else if (!trends) status = `Loading ${done} of ${total} years…`;
  else if (trends.length === 0) status = "No hot spots in these years.";

  return (
    <div
      className="map-panel map-legend"
      aria-label="Trend legend"
      role="group"
    >
      <div className="mb-1 text-[12px] font-medium text-[var(--text)]">
        Trend in hot spots{enough ? `, ${from} to ${to}` : ""}
      </div>
      <div className="mb-2.5 text-[10.5px] leading-snug text-[var(--text-faint)]">
        Change per year in each cell's yearly count, harmonized.
      </div>
      {status ? (
        <p className={error ? "text-[var(--warn)]" : "text-[var(--text-dim)]"}>{status}</p>
      ) : (
        <>
          <div className="mb-1 flex justify-end text-[10px] text-[var(--text-faint)]" aria-hidden="true">
            hot spots a year, per year
          </div>
          <ul className="flex flex-col gap-1 text-[11px]">
            {rows.map((row, i) => (
              <li key={row.color} className="flex items-center gap-2 text-[var(--text)]">
                <span
                  aria-hidden="true"
                  className="block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color, opacity: row.opacity }}
                />
                <span className="flex-1">{i === 0 ? "Rising most" : i === rows.length - 1 ? "Falling most" : ""}</span>
                <span className="tabular-nums text-[var(--text-dim)]">
                  {signedCount(row.low)} to {signedCount(row.high)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {hasBox && boxTrend && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--text)]">
          Whole box: the harmonized count {change(boxTrend.harmonized_trend)}; counted raw, it{" "}
          {change(boxTrend.raw_trend)}.
        </p>
      )}
      {!status && <div className="mt-2 text-[11px] text-[var(--text-faint)]">{pointVerb()} a cell for its trend.</div>}
    </div>
  );
}
