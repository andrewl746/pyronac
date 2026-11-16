// Fake API answers so the frontend works before the backend exists.
// The numbers are invented but have the right shape.
import type {
  AnomalyResponse,
  Bbox,
  CalendarMonth,
  CalendarResponse,
  CompareLabel,
  CompareResponse,
  Era,
  GridResponse,
  MetaResponse,
  PointsCount,
  TrendFit,
  TrendResponse,
} from "./types";

const SEASON = [0, 0, 0.02, 0.2, 1, 2.5, 4, 3, 1, 0.2, 0.05, 0];
const BIG_YEARS: Record<number, number> = { 2004: 2, 2014: 3, 2017: 1.8, 2023: 5 };
const VIIRS_PER_MODIS = 4.5;
const LAST = { year: 2026, month: 11, day: 6 };

function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function eraOf(year: number, month: number): Era {
  const ym = year * 100 + month;
  if (ym <= 201201) return "modis";
  if (ym <= 202610) return "snpp";
  return "noaa20";
}

function snap(b: Bbox): Bbox {
  return {
    west: Math.floor(b.west * 10) / 10,
    south: Math.floor(b.south * 10) / 10,
    east: Math.ceil(b.east * 10) / 10,
    north: Math.ceil(b.north * 10) / 10,
  };
}

function monthRow(b: Bbox, year: number, month: number): CalendarMonth {
  const area = Math.max(0.01, (b.east - b.west) * (b.north - b.south));
  const base = 12 * area * SEASON[month - 1] * (BIG_YEARS[year] ?? 1) * (0.6 + 0.8 * noise(year * 13 + month));
  const era = eraOf(year, month);
  const modis = Math.round(base);
  const viirs = era === "modis" ? null : Math.round(base * VIIRS_PER_MODIS);
  return {
    year,
    month,
    harmonized: viirs ?? Math.round(modis * VIIRS_PER_MODIS * 10) / 10,
    raw: viirs ?? modis,
    modis,
    viirs,
    era,
    complete: !(year === LAST.year && month === LAST.month),
  };
}

function monthsFor(b: Bbox, startYear: number, endYear: number): CalendarMonth[] {
  const rows: CalendarMonth[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year * 100 + month > LAST.year * 100 + LAST.month) break;
      rows.push(monthRow(b, year, month));
    }
  }
  return rows;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function labelFor(percentile: number): CompareLabel {
  if (percentile >= 90) return "well above normal";
  if (percentile >= 75) return "above normal";
  if (percentile > 25) return "near normal";
  if (percentile > 10) return "below normal";
  return "well below normal";
}

function fit(values: number[]): TrendFit {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, v) => a + v, 0) / Math.max(1, n);
  let top = 0;
  let bottom = 0;
  values.forEach((v, i) => {
    top += (i - meanX) * (v - meanY);
    bottom += (i - meanX) ** 2;
  });
  const slope = bottom === 0 ? 0 : top / bottom;
  return {
    slope_per_year: Math.round(slope * 10) / 10,
    percent_per_decade: meanY === 0 ? null : Math.round(((slope * 10) / meanY) * 1000) / 10,
    p_value: 0.2,
    direction: "no clear trend",
  };
}

export const mock = {
  meta(): MetaResponse {
    return {
      app: "Pyronac",
      data_source: "fixtures",
      first_month: "2003-01",
      last_month: "2026-11",
      last_complete_month: "2026-10",
      data_through: "2026-11-06",
      countries: ["canada"],
      presets: [
        { id: "fixture", name: "Test box near Yellowknife", bbox: { west: -116, south: 61, east: -114, north: 63 } },
        { id: "nwt", name: "Northwest Territories, Canada", bbox: { west: -136.5, south: 60, east: -102, north: 70 } },
      ],
      eras: [
        { id: "modis", label: "MODIS, scaled to match VIIRS", from: "2003-01", to: "2012-01" },
        { id: "snpp", label: "VIIRS on Suomi NPP, as observed", from: "2012-02", to: "2026-10" },
        { id: "noaa20", label: "VIIRS on NOAA-20, scaled to match Suomi NPP", from: "2026-11", to: null },
      ],
      harmonization: {
        method: "v0",
        generated_at: "2026-11-14T13:00:00Z",
        data_through: "2026-11-06",
        reference: "VIIRS S-NPP 375 m",
        handoff_ratio_noaa20: 1,
        train_years: null,
        test_years: null,
        validation: null,
        notes: "Mock data.",
      },
    };
  },

  calendar(bbox: Bbox, startYear = 2003, endYear = 2026): CalendarResponse {
    const b = snap(bbox);
    const months = monthsFor(b, startYear, endYear);
    return {
      bbox: b,
      start_year: startYear,
      end_year: endYear,
      months,
      max_harmonized: Math.max(0, ...months.map((m) => m.harmonized)),
      max_raw: Math.max(0, ...months.map((m) => m.raw)),
    };
  },

  compare(bbox: Bbox, year = 2026, month = 10, baselineStart = 2003, baselineEnd = 2025): CompareResponse {
    const b = snap(bbox);
    const target = monthRow(b, year, month);
    const history: { year: number; harmonized: number }[] = [];
    for (let y = baselineStart; y <= baselineEnd; y++) {
      if (y !== year) history.push({ year: y, harmonized: monthRow(b, y, month).harmonized });
    }
    const sorted = history.map((h) => h.harmonized).sort((a, c) => a - c);
    const median = quantile(sorted, 0.5);
    const below = sorted.filter((v) => v < target.harmonized).length;
    const percentile = sorted.length === 0 ? 0 : Math.round((1000 * below) / sorted.length) / 10;
    return {
      bbox: b,
      target: {
        year,
        month,
        harmonized: target.harmonized,
        complete: target.complete,
        days_covered: target.complete ? new Date(year, month, 0).getDate() : LAST.day,
      },
      baseline: {
        start_year: baselineStart,
        end_year: baselineEnd,
        n_years: sorted.length,
        median,
        p25: quantile(sorted, 0.25),
        p75: quantile(sorted, 0.75),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      },
      difference: {
        absolute: Math.round((target.harmonized - median) * 10) / 10,
        percent: median === 0 ? null : Math.round(((target.harmonized - median) / median) * 1000) / 10,
        rank: sorted.filter((v) => v > target.harmonized).length + 1,
        of: sorted.length + 1,
        percentile,
        label: target.harmonized === median ? "near normal" : labelFor(percentile),
      },
      history,
    };
  },

  grid(bbox: Bbox, start = "2023-07", end = "2023-07", step = 1): GridResponse {
    const b = snap(bbox);
    const cells: [number, number, number][] = [];
    const x0 = Math.round((b.west * 10) / step);
    const x1 = Math.round((b.east * 10) / step);
    const y0 = Math.round((b.south * 10) / step);
    const y1 = Math.round((b.north * 10) / step);
    const stride = Math.max(1, Math.ceil(((x1 - x0) * (y1 - y0)) / 4000));
    let index = 0;
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        index++;
        if (index % stride !== 0) continue;
        const n = noise(x * 7.1 + y * 3.3);
        if (n > 0.35) continue;
        cells.push([x, y, Math.round(1 + 400 * n * n * 8)]);
      }
    }
    return { bbox: b, start, end, step, cells, max: Math.max(0, ...cells.map((c) => c[2])) };
  },

  trend(bbox: Bbox, startYear = 2003, endYear = 2025): TrendResponse {
    const b = snap(bbox);
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      const rows = monthsFor(b, year, year);
      const harmonized = rows.reduce((a, m) => a + m.harmonized, 0);
      const raw = rows.reduce((a, m) => a + m.raw, 0);
      const weighted = rows.reduce((a, m) => a + m.month * m.harmonized, 0);
      years.push({
        year,
        harmonized: Math.round(harmonized * 10) / 10,
        raw,
        season_center: harmonized === 0 ? null : Math.round((weighted / harmonized) * 100) / 100,
      });
    }
    return {
      bbox: b,
      start_year: startYear,
      end_year: endYear,
      years,
      harmonized_trend: fit(years.map((y) => y.harmonized)),
      raw_trend: { ...fit(years.map((y) => y.raw)), p_value: 0.001, direction: "increasing" },
      season_shift: { days_per_decade: -2.1, p_value: 0.4 },
    };
  },

  anomaly(bbox: Bbox, year = 2023, month = 7, step = 1): AnomalyResponse {
    const g = mock.grid(bbox, "2023-07", "2023-07", step);
    return {
      bbox: g.bbox,
      year,
      month,
      step,
      cells: g.cells.map(([x, y, v]) => {
        const median = Math.round(v * (0.2 + noise(x + y * 1.7)));
        return [x, y, v, median, Math.round(100 * noise(x * 1.3 + y))];
      }),
    };
  },

  pointsCount(): PointsCount {
    return { count: 12431 };
  },
};
