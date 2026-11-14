// The same numbers as the calendar, as an HTML table. This is the calendar's text alternative.
import type { CalendarMonth, Mode } from "../../api/types";
import { formatCount, monthName, monthShort } from "../../lib/format";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type Props = { months: CalendarMonth[]; mode: Mode };

export function CalendarTable({ months, mode }: Props) {
  const byKey = new Map(months.map((m) => [m.year * 100 + m.month, m]));
  const years = [...new Set(months.map((m) => m.year))].sort((a, b) => b - a);
  const valueOf = (m: CalendarMonth) => (mode === "harmonized" ? m.harmonized : m.raw);
  const hasPartial = months.some((m) => !m.complete);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-right text-xs">
        <caption className="pb-1 text-left" style={{ color: "var(--text-dim)" }}>
          Hot spots per month, {mode}.{hasPartial ? " * marks a partial month." : ""}
        </caption>
        <thead>
          <tr style={{ color: "var(--text-dim)" }}>
            <th scope="col" className="px-1 text-left font-normal">
              Year
            </th>
            {MONTHS.map((month) => (
              <th key={month} scope="col" className="px-1 font-normal">
                <abbr title={monthName(month)} className="no-underline">
                  {monthShort(month)}
                </abbr>
              </th>
            ))}
            <th scope="col" className="px-1 font-normal">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const row = MONTHS.map((month) => byKey.get(year * 100 + month));
            const total = row.reduce((sum, m) => sum + (m ? valueOf(m) : 0), 0);
            return (
              <tr key={year} style={{ borderTop: "1px solid var(--border)" }}>
                <th scope="row" className="px-1 text-left font-normal" style={{ color: "var(--text-dim)" }}>
                  {year}
                </th>
                {row.map((m, index) => (
                  <td key={index} className="px-1">
                    {m ? formatCount(valueOf(m)) + (m.complete ? "" : "*") : ""}
                  </td>
                ))}
                <td className="px-1 font-semibold">{formatCount(Math.round(total * 10) / 10)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
