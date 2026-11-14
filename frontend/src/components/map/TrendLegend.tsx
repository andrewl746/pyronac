import { change } from "../trend/sentences";
import { signedCount, TREND_COLORS, type TrendMap } from "./trend";

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
      className="pointer-events-auto absolute bottom-3 left-3 z-10 w-72 rounded-md border border-[var(--border)] bg-[var(--panel)]/90 p-3 text-xs shadow-lg backdrop-blur"
      aria-label="Trend legend"
      role="group"
    >
      <div className="mb-1 font-semibold text-[var(--text)]">
        Trend in hot spots{enough ? `, ${from} to ${to}` : ""}
      </div>
      <div className="mb-2 text-[var(--text-dim)]">
        Change per year in each cell's yearly count. Harmonized, so the 2012 change of sensor is not a rise.
      </div>
      {status ? (
        <p className={error ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}>{status}</p>
      ) : (
        <>
          <div className="mb-1 flex justify-end text-[var(--text-dim)]" aria-hidden="true">
            hot spots a year, per year
          </div>
          <ul className="flex flex-col gap-1">
            {rows.map((row, i) => (
              <li key={row.color} className="flex items-center gap-2 text-[var(--text)]">
                <span
                  aria-hidden="true"
                  className="block h-3 w-5 shrink-0 rounded-sm border border-black/40"
                  style={{ backgroundColor: row.color }}
                />
                <span className="flex-1">{i === 0 ? "Highest trend" : i === rows.length - 1 ? "Lowest trend" : ""}</span>
                <span className="tabular-nums text-[var(--text-dim)]">
                  {signedCount(row.low)} to {signedCount(row.high)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {hasBox && boxTrend && (
        <p className="mt-2 text-[var(--text)]">
          Whole box: the harmonized count {change(boxTrend.harmonized_trend)}; counted raw, it{" "}
          {change(boxTrend.raw_trend)}.
        </p>
      )}
      {!status && <div className="mt-2 text-[var(--text-dim)]">Hover a cell for its trend.</div>}
    </div>
  );
}
