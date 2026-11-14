// The trend in words, built from /api/trend by fixed templates (MASTERSPEC.md section 13, item 1).
// This is the text alternative to the trend chart, so it must stand on its own.
import type { MetaResponse, TrendFit, TrendResponse } from "../../api/types";
import { formatCount } from "../../lib/format";

// The latest year whose December is complete, from meta.last_complete_month ("2026-10" -> 2025).
export function lastFullYear(meta: MetaResponse): number {
  const [year, month] = meta.last_complete_month.split("-").map(Number);
  return month === 12 ? year : year - 1;
}

// The years the trend covers: the selected range, cut to full years. Null when fewer than 3 remain,
// because /api/trend needs at least 3.
export function trendYears(meta: MetaResponse, startYear: number, endYear: number): [number, number] | null {
  const end = Math.min(endYear, lastFullYear(meta));
  return end - startYear + 1 >= 3 ? [startYear, end] : null;
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

  const rawPercent = data.raw_trend.percent_per_decade ?? 0;
  const harmonizedPercent =
    data.harmonized_trend.direction === "increasing" ? (data.harmonized_trend.percent_per_decade ?? 0) : 0;
  const coversSwitch = data.start_year <= 2011 && data.end_year >= 2012;
  const inventedRise =
    coversSwitch && data.raw_trend.direction === "increasing" && harmonizedPercent < rawPercent / 2;

  return inventedRise
    ? `${raw} ${harmonized} Most of the raw rise is the 2012 switch from MODIS to the sharper VIIRS sensor.`
    : `${raw} ${harmonized}`;
}
