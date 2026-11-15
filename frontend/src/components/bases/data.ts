// Loads base_sites.json only once the planner is switched on, as its own small file, so with the
// planner off the app loads nothing new. It is a file shipped with the screen, not an API call.
import { useQuery } from "@tanstack/react-query";
import type { BaseSites, Reach, ReachResult } from "./types";

async function loadBaseSites(): Promise<BaseSites> {
  const module = await import("./base_sites.json");
  return module.default as unknown as BaseSites;
}

export function useBaseSites(enabled: boolean) {
  return useQuery({ queryKey: ["baseSites"], queryFn: loadBaseSites, enabled, staleTime: Infinity });
}

// The results for a reach. The reach choice is built from the file's own `reaches`, so a reach the
// file does not have only happens if the file changes; then the first one in the file is used.
export function reachResult(data: BaseSites | undefined, reach: Reach): ReachResult | undefined {
  return data?.reaches.find((r) => r.reach_km === reach) ?? data?.reaches[0];
}

// The lists differ in length by reach (the calculation stops when a new base adds too little), so
// the number of bases shown is never more than the list holds.
export function shownCount(count: number, result: ReachResult): number {
  return Math.min(Math.max(count, 1), result.sites.length);
}
