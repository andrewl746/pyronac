// The base planner's own state. Kept apart from state/store.ts (Appendix A), so with the
// planner off nothing in the rest of the app changes.
import type { Map as MapLibreMap } from "maplibre-gl";
import { create } from "zustand";
import type { Reach } from "./types";

export const MIN_BASES = 1;
export const MAX_BASES = 100;

type BaseState = {
  on: boolean; // "Show bases", off by default
  count: number; // how many bases asked for; the panel shows at most the list length for the reach
  reach: Reach; // km, one of the reaches in base_sites.json; 100 by default
  printing: boolean; // true while the base list is being printed
  mapImage: string | null; // a picture of the map for the printed list (a data URL)
  map: MapLibreMap | null; // set by the map, so the print button can take its picture
  setOn: (on: boolean) => void;
  setCount: (count: number) => void;
  setReach: (reach: Reach) => void;
  setPrinting: (printing: boolean, mapImage?: string | null) => void;
  setMap: (map: MapLibreMap | null) => void;
};

export const useBases = create<BaseState>()((set) => ({
  on: false,
  count: 25,
  reach: 100,
  printing: false,
  mapImage: null,
  map: null,
  setOn: (on) => set({ on }),
  setCount: (count) => set({ count: Math.min(MAX_BASES, Math.max(MIN_BASES, Math.round(count))) }),
  setReach: (reach) => set({ reach }),
  setPrinting: (printing, mapImage = null) => set({ printing, mapImage }),
  setMap: (map) => set({ map }),
}));
