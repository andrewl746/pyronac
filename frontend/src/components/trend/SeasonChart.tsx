// The centre of each year's fire season (average month, weighted by harmonized count), by year.
// Years with no fire leave a gap. MASTERSPEC.md section 13, item 5.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendResponse } from "../../api/types";
import { monthName, monthShort } from "../../lib/format";

type Row = TrendResponse["years"][number];

// A month number stands for the middle of that month: 7 -> "mid-July", 7.4 -> "late July", 7.6 -> "early August".
function seasonLabel(center: number): string {
  const month = Math.min(12, Math.max(1, Math.round(center)));
  const offset = center - Math.round(center);
  if (offset < -1 / 6) return `early ${monthName(month)}`;
  if (offset > 1 / 6) return `late ${monthName(month)}`;
  return `mid-${monthName(month)}`;
}

export function SeasonChart({ data }: { data: TrendResponse }) {
  const centers = data.years.map((year) => year.season_center).filter((c): c is number => c !== null);
  let low = Math.max(1, Math.floor(Math.min(...centers)));
  let high = Math.min(12, Math.ceil(Math.max(...centers)));
  if (high - low < 1) {
    low = Math.max(1, low - 1);
    high = Math.min(12, high + 1);
  }
  const ticks = Array.from({ length: high - low + 1 }, (_, i) => low + i);

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data.years} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          width={44}
          domain={[low, high]}
          ticks={ticks}
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "var(--text-dim)" }}
          tickFormatter={(value: number) => monthShort(value)}
          tickLine={false}
          axisLine={false}
        />
        <Line
          dataKey="season_center"
          name="Season centre"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ r: 2, fill: "var(--accent)", strokeWidth: 0 }}
          connectNulls={false}
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
                className="rounded-[4px] border px-2 py-1 text-xs tabular-nums"
                style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <div className="font-semibold">{row.year}</div>
                <div>{row.season_center === null ? "No fire" : `Season centre: ${seasonLabel(row.season_center)}`}</div>
              </div>
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
