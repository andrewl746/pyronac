// The trend in words, built from /api/trend by fixed templates (MASTERSPEC.md section 13, item 1).
// This is the text alternative to the trend chart, so it must stand on its own.
import type { MetaResponse, TrendFit, TrendResponse } from "../../api/types";
import { formatCount } from "../../lib/format";

// The latest year whose December is complete, from meta.last_complete_month ("2026-10" -> 2025).
export function lastFullYear(meta: MetaResponse): number {
  const [year, month] = meta.last_complete_month.split("-").map(Number);
  return month === 12 ? year : year - 1;
}

// The years to ask /api/trend for: the selected range, cut to full years. The end is left out
// (undefined) whenever it reaches the last full year, so the backend's own default stops the fit there
// and a partial year never skews it. Null when fewer than 3 full years remain, because the API needs 3.
export function trendYears(
  meta: MetaResponse,
  startYear: number,
  endYear: number,
): [number, number | undefined] | null {
  const lastFull = lastFullYear(meta);
  const end = Math.min(endYear, lastFull);
  if (end - startYear + 1 < 3) return null;
  return [startYear, end === lastFull ? undefined : end];
}

// "rose about 12% per decade", "fell about 8% per decade", "shows no clear trend"
export function change(fit: TrendFit): string {
  if (fit.direction === "no clear trend" || fit.percent_per_decade === null) return "shows no clear trend";
  const percent = formatCount(Math.abs(Math.round(fit.percent_per_decade)));
  return `${fit.direction === "increasing" ? "rose" : "fell"} about ${percent}% per decade`;
}

function hasFire(data: TrendResponse): boolean {
  return data.years.some((year) => year.harmonized > 0 || year.raw > 0);
}

// Raw against harmonized. The point of the chart: the raw record invents a rise at the 2012 sensor change.
export function trendSentence(data: TrendResponse): string {
  const span = `${data.start_year} to ${data.end_year}`;
  if (!hasFire(data)) return `No hot spots were detected here from ${span}.`;

  const raw = `Counted as the satellites reported them, the yearly count here ${change(data.raw_trend)} from ${span}.`;
  const harmonized = `On one consistent scale the record ${change(data.harmonized_trend)}.`;

  // Only meaningful when the years cross the 2012 switch from MODIS to VIIRS.
  const coversSwitch = data.start_year <= 2011 && data.end_year >= 2012;
  const rawRises = data.raw_trend.direction === "increasing";
  if (!coversSwitch || !rawRises) return `${raw} ${harmonized}`;

  const rawPercent = data.raw_trend.percent_per_decade ?? 0;
  const harmonizedPercent =
    data.harmonized_trend.direction === "increasing" ? (data.harmonized_trend.percent_per_decade ?? 0) : 0;
  if (harmonizedPercent < rawPercent / 2) {
    return `${raw} ${harmonized} Most of the raw rise is the 2012 switch from MODIS to the sharper VIIRS sensor.`;
  }
  if (harmonizedPercent < rawPercent) {
    return `${raw} ${harmonized} The raw record overstates the rise: part of it is the 2012 switch from MODIS to the sharper VIIRS sensor.`;
  }
  return `${raw} ${harmonized}`;
}
