// The plain-language summary, built from the numbers by fixed templates, never by an AI model:
// the busiest year, the usual peak month, how this month
// compares, and the trend.
import type { CalendarMonth, TrendResponse } from "../../api/types";
import { formatCount, monthName } from "../../lib/format";
import { change } from "../trend/sentences";

function hotSpots(value: number): string {
  const rounded = Math.round(value);
  return `${formatCount(rounded)} hot ${rounded === 1 ? "spot" : "spots"}`;
}

// "The busiest year here was 2023, with 1,234,567 hot spots." Null when no year had fire.
export function busiestYear(trend: TrendResponse): string | null {
  let best = trend.years[0];
  for (const year of trend.years) if (year.harmonized > best.harmonized) best = year;
  if (!best || best.harmonized <= 0) return null;
  return `The busiest year here from ${trend.start_year} to ${trend.end_year} was ${best.year}, with ${hotSpots(best.harmonized)}.`;
}

// "Fire usually peaks in August, which holds 34% of the hot spots." Complete months only. Null without fire.
export function peakMonth(months: CalendarMonth[]): string | null {
  const totals = new Array<number>(12).fill(0);
  for (const m of months) if (m.complete) totals[m.month - 1] += m.harmonized;
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const peak = totals.indexOf(Math.max(...totals));
  const share = Math.round((totals[peak] / sum) * 100);
  return `Fire usually peaks in ${monthName(peak + 1)}, which holds ${share}% of the hot spots on record here.`;
}

// "On one consistent scale, the yearly count rose about 12% per decade since 2003."
export function trendLine(trend: TrendResponse): string | null {
  if (!trend.years.some((year) => year.harmonized > 0)) return null;
  return `On one consistent scale, the yearly count ${change(trend.harmonized_trend)} since ${trend.start_year}.`;
}

// Joins the sentences that exist. When none do, a single line saying there is no fire on record.
export function summary(parts: (string | null)[], startYear: number, endYear: number): string {
  const sentences = parts.filter((part): part is string => Boolean(part));
  return sentences.length ? sentences.join(" ") : `No hot spots were detected here from ${startYear} to ${endYear}.`;
}
