// Text helpers for the map. Sam's src/lib/format.ts can replace these once it exists.
import type { YearMonth } from "../../api/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatCount(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-US");
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? "";
}

function ym(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// The period the map shows (MASTERSPEC.md section 8): the selected month if there is one,
// otherwise January of startYear to December of endYear.
export function mapPeriod(selected: YearMonth | null, startYear: number, endYear: number) {
  if (selected) {
    const month = ym(selected.year, selected.month);
    return { start: month, end: month, label: `${monthName(selected.month)} ${selected.year}` };
  }
  const label = startYear === endYear ? `${startYear}` : `${startYear} to ${endYear}`;
  return { start: ym(startYear, 1), end: ym(endYear, 12), label };
}
