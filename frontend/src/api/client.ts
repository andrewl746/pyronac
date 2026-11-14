// The only place the frontend talks to the backend.
// Copied from MASTERSPEC.md Appendix A. Change only with team agreement.
import { mock } from "./mock";
import type {
  AnomalyResponse,
  Bbox,
  CalendarResponse,
  CompareResponse,
  GridResponse,
  MetaResponse,
  PointsCount,
  SensorFilter,
  TrendResponse,
} from "./types";

const BASE: string = import.meta.env.VITE_API_BASE ?? "";
const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === "1";

type Params = Record<string, string | number | undefined>;

function query(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}

function url(path: string, params: Params): string {
  const q = query(params);
  return q ? `${BASE}${path}?${q}` : `${BASE}${path}`;
}

async function get<T>(path: string, params: Params = {}): Promise<T> {
  const response = await fetch(url(path, params));
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export const api = {
  meta: (): Promise<MetaResponse> => (USE_MOCKS ? Promise.resolve(mock.meta()) : get("/api/meta")),

  calendar: (bbox: Bbox, startYear: number, endYear: number): Promise<CalendarResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.calendar(bbox, startYear, endYear))
      : get("/api/calendar", { ...bbox, start_year: startYear, end_year: endYear }),

  // Leave year and month out to get the latest complete month.
  compare: (
    bbox: Bbox,
    year?: number,
    month?: number,
    baselineStart?: number,
    baselineEnd?: number,
  ): Promise<CompareResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.compare(bbox, year, month, baselineStart, baselineEnd))
      : get("/api/compare", { ...bbox, year, month, baseline_start: baselineStart, baseline_end: baselineEnd }),

  // start and end are "YYYY-MM", both included. Leave step out and the backend picks one.
  grid: (bbox: Bbox, start: string, end: string, step?: number): Promise<GridResponse> =>
    USE_MOCKS ? Promise.resolve(mock.grid(bbox, start, end, step)) : get("/api/grid", { ...bbox, start, end, step }),

  trend: (bbox: Bbox, startYear?: number, endYear?: number): Promise<TrendResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.trend(bbox, startYear, endYear))
      : get("/api/trend", { ...bbox, start_year: startYear, end_year: endYear }),

  anomaly: (bbox: Bbox, year: number, month: number, step?: number): Promise<AnomalyResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.anomaly(bbox, year, month, step))
      : get("/api/anomaly", { ...bbox, year, month, step }),

  // start and end are "YYYY-MM-DD", both included.
  pointsCount: (bbox: Bbox, start: string, end: string, sensor: SensorFilter = "all"): Promise<PointsCount> =>
    USE_MOCKS ? Promise.resolve(mock.pointsCount()) : get("/api/points/count", { ...bbox, start, end, sensor }),

  // Links for <a href download>. With mocks on they point at the real backend and will not work.
  pointsCsvUrl: (bbox: Bbox, start: string, end: string, sensor: SensorFilter = "all"): string =>
    url("/api/points.csv", { ...bbox, start, end, sensor }),

  calendarCsvUrl: (bbox: Bbox, startYear: number, endYear: number): string =>
    url("/api/calendar.csv", { ...bbox, start_year: startYear, end_year: endYear }),
};
