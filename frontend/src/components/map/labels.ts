import type { YearMonth } from "../../api/types";
import { formatMonthYear } from "../../lib/format";

// (2023, 7) -> "2023-07"
export function ym(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// "2026-10" -> { year: 2026, month: 10 }, null for anything else.
export function parseYearMonth(text: string | undefined): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(text ?? "");
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

// The period the map shows (MASTERSPEC.md section 8): the selected month if there is one,
// otherwise January of startYear to December of endYear.
export function mapPeriod(selected: YearMonth | null, startYear: number, endYear: number) {
  if (selected) {
    const month = ym(selected.year, selected.month);
    return { start: month, end: month, label: formatMonthYear(selected.year, selected.month) };
  }
  const label = startYear === endYear ? `${startYear}` : `${startYear} to ${endYear}`;
  return { start: ym(startYear, 1), end: ym(endYear, 12), label };
}
