// One TanStack Query hook per `api` function (MASTERSPEC.md section 8).
// The query key is the function name followed by its arguments.
// Every hook except useMeta is disabled while `bbox` is null. The map's world view
// passes the whole-world box to useGrid, so it is never null there.
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Bbox, SensorFilter } from "./types";

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
}

export function useCalendar(bbox: Bbox | null, startYear: number, endYear: number) {
  return useQuery({
    queryKey: ["calendar", bbox, startYear, endYear],
    queryFn: bbox ? () => api.calendar(bbox, startYear, endYear) : skipToken,
  });
}

// Leave year and month out to compare the latest complete month.
export function useCompare(
  bbox: Bbox | null,
  year?: number,
  month?: number,
  baselineStart?: number,
  baselineEnd?: number,
) {
  return useQuery({
    queryKey: ["compare", bbox, year, month, baselineStart, baselineEnd],
    queryFn: bbox ? () => api.compare(bbox, year, month, baselineStart, baselineEnd) : skipToken,
  });
}

// start and end are "YYYY-MM", both included. Leave step out and the backend picks one.
// The previous answer stays on screen while the next one loads, so the map does not flash.
export function useGrid(bbox: Bbox | null, start: string, end: string, step?: number) {
  return useQuery({
    queryKey: ["grid", bbox, start, end, step],
    queryFn: bbox ? () => api.grid(bbox, start, end, step) : skipToken,
    placeholderData: keepPreviousData,
  });
}

export function useTrend(bbox: Bbox | null, startYear?: number, endYear?: number) {
  return useQuery({
    queryKey: ["trend", bbox, startYear, endYear],
    queryFn: bbox ? () => api.trend(bbox, startYear, endYear) : skipToken,
  });
}

export function useAnomaly(bbox: Bbox | null, year: number, month: number, step?: number) {
  return useQuery({
    queryKey: ["anomaly", bbox, year, month, step],
    queryFn: bbox ? () => api.anomaly(bbox, year, month, step) : skipToken,
    placeholderData: keepPreviousData,
  });
}

// start and end are "YYYY-MM-DD", both included.
export function usePointsCount(bbox: Bbox | null, start: string, end: string, sensor: SensorFilter = "all") {
  return useQuery({
    queryKey: ["pointsCount", bbox, start, end, sensor],
    queryFn: bbox ? () => api.pointsCount(bbox, start, end, sensor) : skipToken,
  });
}
