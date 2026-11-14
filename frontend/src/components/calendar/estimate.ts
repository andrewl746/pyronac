// The range of the estimate for months before February 2012 (section 13, extra 4).
// Those months are MODIS counts converted to the VIIRS scale, so they carry an error.
// The size of the error is the validation error in harmonization.json: the typical distance
// between the estimate and what Suomi NPP observed, for monthly totals in the test years.
import type { MetaResponse } from "../../api/types";

export type Estimate = {
  error: number; // a fraction: 0.106 means the typical monthly total is 10.6% off
  modisEraEnd: number; // the last month of the MODIS era as year * 100 + month, for example 201201
};

// Null when the data has no validation numbers yet, as with the v0 placeholder.
export function estimateFrom(meta: MetaResponse | undefined): Estimate | null {
  const error = meta?.harmonization.validation?.harmonized_error;
  const to = meta?.eras.find((era) => era.id === "modis")?.to; // "2012-01"
  if (error === undefined || !(error > 0) || !to) return null;
  return { error, modisEraEnd: Number(to.slice(0, 4)) * 100 + Number(to.slice(5, 7)) };
}

export function isEstimated(estimate: Estimate | null, year: number, month: number): estimate is Estimate {
  return estimate !== null && year * 100 + month <= estimate.modisEraEnd;
}

// value 100 with error 0.106 -> low 89.4, high 110.6
export function estimateRange(value: number, error: number): { low: number; high: number } {
  const round = (n: number) => Math.round(n * 10) / 10;
  return { low: round(Math.max(0, value * (1 - error))), high: round(value * (1 + error)) };
}

// 0.1062 -> "10.6%"
export function errorPercent(error: number): string {
  return `${Math.round(error * 1000) / 10}%`;
}
