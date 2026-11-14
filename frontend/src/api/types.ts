// Shared API types. Copied from MASTERSPEC.md Appendix A. Change only with team agreement.

export type Bbox = { west: number; south: number; east: number; north: number };
export type Era = "modis" | "snpp" | "noaa20";
export type Mode = "harmonized" | "raw";
export type SensorFilter = "all" | "modis" | "viirs";
export type YearMonth = { year: number; month: number };

export type Preset = { id: string; name: string; bbox: Bbox };

export type Harmonization = {
  method: "v0" | "ratio" | "ml";
  generated_at: string; // ISO time, UTC
  data_through: string; // "2026-11-06"
  reference: string; // "VIIRS S-NPP 375 m"
  handoff_ratio_noaa20: number;
  train_years: [number, number] | null;
  test_years: [number, number] | null;
  validation: { metric: string; raw_error: number; harmonized_error: number } | null;
  notes: string;
};

export type MetaResponse = {
  app: string;
  data_source: "fixtures" | "processed";
  first_month: string; // "2003-01"
  last_month: string; // latest month with any data, for example "2026-11"
  last_complete_month: string; // for example "2026-10"
  data_through: string; // "2026-11-06"
  countries: string[];
  presets: Preset[];
  eras: { id: Era; label: string; from: string; to: string | null }[];
  harmonization: Harmonization;
};

export type CalendarMonth = {
  year: number;
  month: number; // 1 to 12
  harmonized: number;
  raw: number;
  modis: number;
  viirs: number | null; // null before 2012-02
  era: Era;
  complete: boolean;
};

export type CalendarResponse = {
  bbox: Bbox;
  start_year: number;
  end_year: number;
  months: CalendarMonth[];
  max_harmonized: number;
  max_raw: number;
};

export type CompareLabel =
  | "well above normal"
  | "above normal"
  | "near normal"
  | "below normal"
  | "well below normal";

export type CompareResponse = {
  bbox: Bbox;
  target: { year: number; month: number; harmonized: number; complete: boolean; days_covered: number };
  baseline: {
    start_year: number;
    end_year: number;
    n_years: number;
    median: number;
    p25: number;
    p75: number;
    min: number;
    max: number;
  };
  difference: {
    absolute: number;
    percent: number | null; // null when the median is 0
    rank: number; // 1 is the highest
    of: number;
    percentile: number; // 0 to 100
    label: CompareLabel;
  };
  history: { year: number; harmonized: number }[];
};

// cells are [x, y, harmonized]. A cell covers longitude x*step/10 to (x+1)*step/10
// and latitude y*step/10 to (y+1)*step/10.
export type GridResponse = {
  bbox: Bbox;
  start: string; // "2023-06"
  end: string; // "2023-08"
  step: number; // 1, 5 or 10
  cells: [number, number, number][];
  max: number;
};

export type TrendFit = {
  slope_per_year: number;
  percent_per_decade: number | null;
  p_value: number;
  direction: "increasing" | "decreasing" | "no clear trend";
};

export type TrendResponse = {
  bbox: Bbox;
  start_year: number;
  end_year: number;
  years: { year: number; harmonized: number; raw: number; season_center: number | null }[];
  harmonized_trend: TrendFit;
  raw_trend: TrendFit;
  season_shift: { days_per_decade: number; p_value: number } | null;
};

// cells are [x, y, harmonized, median, percentile], same cell geometry as GridResponse.
export type AnomalyResponse = {
  bbox: Bbox;
  year: number;
  month: number;
  step: number;
  cells: [number, number, number, number, number][];
};

export type PointsCount = { count: number };
