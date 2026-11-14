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

// Every month from January of startYear to December of endYear, kept inside the months that have
// data (first_month to last_month from /api/meta). The store's endYear can be past the data,
// for example 2026 when the data ends in December 2025 (issue #21), so the data decides the end.
export function monthRange(firstMonth: string, lastMonth: string, startYear: number, endYear: number): YearMonth[] {
  const first = parseYearMonth(firstMonth);
  const last = parseYearMonth(lastMonth);
  if (!first || !last) return [];
  const from = Math.max(startYear * 12, first.year * 12 + first.month - 1);
  const to = Math.min(endYear * 12 + 11, last.year * 12 + last.month - 1);
  const months: YearMonth[] = [];
  for (let i = from; i <= to; i++) months.push({ year: Math.floor(i / 12), month: (i % 12) + 1 });
  return months;
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
