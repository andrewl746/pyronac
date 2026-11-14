// The arithmetic behind the trend view, kept apart so it can be checked on its own.
import type { GridResponse } from "../../api/types";

export type CellTrend = { x: number; y: number; slope: number; mean: number };

// The least-squares slope of each cell's yearly totals against the year, in hot spots per year,
// per year. A cell missing from a year's answer had no hot spots that year.
export function cellTrends(grids: GridResponse[], years: number[]): CellTrend[] {
  const n = years.length;
  const meanYear = years.reduce((a, y) => a + y, 0) / n;
  const sxx = years.reduce((a, y) => a + (y - meanYear) ** 2, 0);
  const totals = new Map<string, number[]>();
  grids.forEach((grid, i) => {
    for (const [x, y, value] of grid.cells) {
      const key = `${x},${y}`;
      let row = totals.get(key);
      if (!row) {
        row = new Array<number>(n).fill(0);
        totals.set(key, row);
      }
      row[i] = value;
    }
  });
  return [...totals.entries()].map(([key, row]) => {
    const [x, y] = key.split(",").map(Number);
    const mean = row.reduce((a, v) => a + v, 0) / n;
    const sxy = row.reduce((a, v, i) => a + (years[i] - meanYear) * (v - mean), 0);
    return { x, y, slope: sxx === 0 ? 0 : sxy / sxx, mean };
  });
}

// Breaks at the 20th, 40th, 60th and 80th percentiles of the slopes, so each colour holds about a
// fifth of the cells and a few extreme cells do not wash the rest out.
export function trendBreaks(slopes: number[]): number[] {
  if (slopes.length === 0) return [];
  const sorted = [...slopes].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => {
    const position = (sorted.length - 1) * q;
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  });
}

// 0 (lowest trend, lightest) to 4 (highest trend, darkest).
export function trendClass(slope: number, breaks: number[]): number {
  return breaks.filter((b) => slope > b).length;
}

// +12, +1.3, -0.04, 0: whole numbers from 10, one decimal from 1, two below that, so small trends
// still read as numbers and only an exact zero shows as 0.
export function signedCount(value: number): string {
  const size = Math.abs(value);
  const places = size >= 10 ? 1 : size >= 1 ? 10 : 100;
  const rounded = Math.round(value * places) / places;
  if (rounded === 0) return "0";
  const digits = places === 100 ? 2 : places === 10 ? 1 : 0;
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits })}`;
}
