// The comparison in words. This is the text alternative to the chart, so it must stand on its own.
import type { CompareResponse } from "../../api/types";
import { formatCount, formatMonthYear, monthName } from "../../lib/format";

// 1 -> "1st", 2 -> "2nd", 4 -> "4th", 11 -> "11th", 23 -> "23rd"
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// "October 2026 was 61% above the usual October here."
export function headline(data: CompareResponse): string {
  const { target, difference } = data;
  const when = formatMonthYear(target.year, target.month);
  const month = monthName(target.month);
  const count = `${formatCount(target.harmonized)} hot ${target.harmonized === 1 ? "spot" : "spots"}`;

  if (difference.percent === null) {
    const had = target.complete ? `${when} had ${count}` : `${when} has ${count} so far`;
    return `No fires are usual here in ${month}. ${had}.`;
  }
  const percent = formatCount(Math.abs(Math.round(difference.percent)));
  const direction = difference.percent > 0 ? "above" : "below";
  if (!target.complete) {
    // A partial month is compared with full months, and the numbers are not scaled up.
    return Math.round(difference.percent) === 0
      ? `It already matches the usual full ${month} here.`
      : `It is ${percent}% ${direction} the usual full ${month} here.`;
  }
  return Math.round(difference.percent) === 0
    ? `${when} was the same as the usual ${month} here.`
    : `${when} was ${percent}% ${direction} the usual ${month} here.`;
}

// "November 2026 so far, 6 days of data". Null for a complete month.
export function partialNote(data: CompareResponse): string | null {
  const { target } = data;
  if (target.complete) return null;
  const days = `${target.days_covered} ${target.days_covered === 1 ? "day" : "days"}`;
  return `${formatMonthYear(target.year, target.month)} so far, ${days} of data`;
}
