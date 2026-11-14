// A compact bar chart, one bar per year: one calendar month in each year, or each year's total.
// The highlighted bar (the picked year, or the busiest year) is in --accent, a dashed line marks the
// median, and an optional band marks the usual range (p25 to p75). A year that is not complete yet
// is drawn faint. Years estimated from MODIS carry a whisker for the range of the estimate.
import { Bar, BarChart, Cell, ErrorBar, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatCount } from "../../lib/format";

// spread is how far the estimate may sit below and above the bar: [minus, plus].
export type CompareRow = { year: number; value: number; highlight: boolean; partial?: boolean; spread?: [number, number] };

type Props = {
  rows: CompareRow[];
  median: number | null;
  band?: [number, number];
  rowLabel: (row: CompareRow) => string; // "July 2014", or "2014"
};

export function CompareChart({ rows, median, band, rowLabel }: Props) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap={1}>
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          width={38}
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickFormatter={(value: number) => formatCompact(value)}
          tickLine={false}
          axisLine={false}
          tickCount={3}
        />
        {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--focus)" fillOpacity={0.18} stroke="none" />}
        <Bar dataKey="value" isAnimationActive={false}>
          {rows.map((row) => (
            <Cell
              key={row.year}
              fill={row.highlight ? "var(--accent)" : "var(--text-dim)"}
              fillOpacity={row.partial ? 0.3 : row.highlight ? 1 : 0.55}
            />
          ))}
          <ErrorBar dataKey="spread" width={3} strokeWidth={1.25} stroke="var(--text)" isAnimationActive={false} />
        </Bar>
        {median !== null && (
          <ReferenceLine y={median} stroke="var(--text)" strokeDasharray="4 3" strokeWidth={1.25} />
        )}
        <Tooltip
          cursor={{ fill: "var(--panel-2)" }}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const row = active ? (payload?.[0]?.payload as CompareRow | undefined) : undefined;
            if (!row) return null;
            return (
              <div
                className="rounded border px-2 py-1 text-xs"
                style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <div className="font-semibold">
                  {rowLabel(row)}
                  {row.partial ? " (so far)" : ""}
                </div>
                <div>{formatCount(row.value)} hot spots</div>
                {row.spread && (
                  <div style={{ color: "var(--text-dim)" }}>
                    Estimate, likely {formatCount(Math.round((row.value - row.spread[0]) * 10) / 10)} to{" "}
                    {formatCount(Math.round((row.value + row.spread[1]) * 10) / 10)}
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
