// The one shared piece of UI state.
// Change only with team agreement.
import { create } from "zustand";
import type { Bbox, Mode, YearMonth } from "../api/types";

export type Ramp = "fire" | "cividis";

type State = {
  bbox: Bbox | null; // the selected area, null until the user picks one
  startYear: number;
  endYear: number;
  mode: Mode; // "harmonized" or "raw"
  selected: YearMonth | null; // the month clicked in the calendar
  ramp: Ramp; // colour ramp, "cividis" is the colour-blind option
  setBbox: (bbox: Bbox | null) => void;
  setYears: (startYear: number, endYear: number) => void;
  setMode: (mode: Mode) => void;
  setSelected: (selected: YearMonth | null) => void;
  setRamp: (ramp: Ramp) => void;
};

export const useStore = create<State>()((set) => ({
  bbox: null,
  startYear: 2003,
  endYear: 2026,
  mode: "harmonized",
  selected: null,
  ramp: "fire",
  setBbox: (bbox) => set({ bbox }),
  setYears: (startYear, endYear) => set({ startYear, endYear }),
  setMode: (mode) => set({ mode }),
  setSelected: (selected) => set({ selected }),
  setRamp: (ramp) => set({ ramp }),
}));
