// One bar per year for one calendar month: the baseline years, and the target year in --accent.
// A line marks the median and a band marks the usual range, p25 to p75.
// Years estimated from MODIS carry a whisker for the range of the estimate.
import { Bar, BarChart, Cell, ErrorBar, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CompareResponse } from "../../api/types";
import { formatCompact, formatCount, formatMonthYear } from "../../lib/format";
import { estimateRange, isEstimated } from "../calendar/estimate";
import type { Estimate } from "../calendar/estimate";

// spread is how far the estimate may sit below and above the bar: [minus, plus]. Only for MODIS-era years.
type Row = { year: number; harmonized: number; isTarget: boolean; spread?: [number, number] };

type Props = { data: CompareResponse; estimate: Estimate | null };

export function CompareChart({ data, estimate }: Props) {
  const { target, baseline, history } = data;
  const rows: Row[] = [
    ...history.map((h) => ({ year: h.year, harmonized: h.harmonized, isTarget: false })),
    { year: target.year, harmonized: target.harmonized, isTarget: true },
  ]
    .sort((a, b) => a.year - b.year)
    .map((row) => {
      if (!(row.harmonized > 0) || !isEstimated(estimate, row.year, target.month)) return row;
      const { low, high } = estimateRange(row.harmonized, estimate.error);
      return { ...row, spread: [row.harmonized - low, high - row.harmonized] as [number, number] };
    });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={1}>
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          width={44}
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickFormatter={(value: number) => formatCompact(value)}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceArea y1={baseline.p25} y2={baseline.p75} fill="var(--focus)" fillOpacity={0.18} stroke="none" />
        <Bar dataKey="harmonized" isAnimationActive={false}>
          {rows.map((row) => (
            <Cell
              key={row.year}
              fill={row.isTarget ? "var(--accent)" : "var(--text-dim)"}
              fillOpacity={row.isTarget ? 1 : 0.55}
            />
          ))}
          <ErrorBar dataKey="spread" width={3} strokeWidth={1.25} stroke="var(--text)" isAnimationActive={false} />
        </Bar>
        <ReferenceLine y={baseline.median} stroke="var(--text)" strokeDasharray="4 3" strokeWidth={1.25} />
        <Tooltip
          cursor={{ fill: "var(--panel-2)" }}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
            if (!row) return null;
            return (
              <div
                className="rounded border px-2 py-1 text-xs"
                style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <div className="font-semibold">
                  {formatMonthYear(row.year, target.month)}
                  {row.isTarget && !target.complete ? " (partial)" : ""}
                </div>
                <div>{formatCount(row.harmonized)} hot spots</div>
                {row.spread && (
                  <div style={{ color: "var(--text-dim)" }}>
                    Estimate, likely {formatCount(Math.round((row.harmonized - row.spread[0]) * 10) / 10)} to{" "}
                    {formatCount(Math.round((row.harmonized + row.spread[1]) * 10) / 10)}
                  </div>
                )}
              </div>
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
