// Yearly totals for the box: harmonized in --accent, raw as reported in a dashed dim line.
// A line marks 2012, when VIIRS joined the record.
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendResponse } from "../../api/types";
import { formatCount } from "../../lib/format";

type Row = TrendResponse["years"][number];

export function TrendChart({ data }: { data: TrendResponse }) {
  const showSwitch = data.start_year <= 2011 && data.end_year >= 2012;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data.years} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          width={52}
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickFormatter={(value: number) => formatCount(value)}
          tickLine={false}
          axisLine={false}
        />
        {showSwitch && (
          <ReferenceLine
            x={2012}
            stroke="var(--text-dim)"
            strokeDasharray="2 3"
            label={{ value: "VIIRS from 2012", position: "insideTopLeft", fontSize: 10, fill: "var(--text-dim)" }}
          />
        )}
        <Line
          dataKey="raw"
          name="Raw"
          stroke="var(--text-dim)"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="harmonized"
          name="Harmonized"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ r: 2, fill: "var(--accent)", strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
            if (!row) return null;
            return (
              <div
                className="rounded border px-2 py-1 text-xs tabular-nums"
                style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <div className="font-semibold">{row.year}</div>
                <div>Harmonized: {formatCount(row.harmonized)}</div>
                <div style={{ color: "var(--text-dim)" }}>Raw: {formatCount(row.raw)}</div>
              </div>
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
