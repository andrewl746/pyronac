// Extra #9 in MASTERSPEC.md section 13: the time-lapse. Play steps through the months of the year
// range by calling setSelected, so the map, the calendar's outlined cell and the compare panel all
// follow. Every month is loaded first, and the hatch scale is fixed to the largest single-month
// cell value in the range, so a quiet month never looks as fierce as a big one.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { gridKey, useMeta } from "../../api/hooks";
import type { YearMonth } from "../../api/types";
import { WORLD, WORLD_STEP } from "../../lib/geo";
import { useStore } from "../../state/store";
import { monthRange, ym } from "./labels";

export type TimeLapsePhase = "idle" | "loading" | "playing";

const NORMAL_STEP_MS = 250; // about four months a second
const REDUCED_STEP_MS = 1000; // once a second under prefers-reduced-motion
const PARALLEL_REQUESTS = 6;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sameMonth(a: YearMonth | null, b: YearMonth | null): boolean {
  return a?.year === b?.year && a?.month === b?.month;
}

// `enabled` is false in the anomaly view: playback stops and Play is unavailable.
export function useTimeLapse(enabled: boolean) {
  const queryClient = useQueryClient();
  const meta = useMeta();
  const bbox = useStore((s) => s.bbox);
  const startYear = useStore((s) => s.startYear);
  const endYear = useStore((s) => s.endYear);
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);

  const firstMonth = meta.data?.first_month ?? "";
  const lastMonth = meta.data?.last_month ?? "";
  const months = useMemo(
    () => monthRange(firstMonth, lastMonth, startYear, endYear),
    [firstMonth, lastMonth, startYear, endYear],
  );
  // What the loaded months and the fixed scale belong to. A new box or year range starts over.
  const contextKey = `${JSON.stringify(bbox)}|${months.length ? ym(months[0].year, months[0].month) : ""}|${months.length}`;

  const [phase, setPhase] = useState<TimeLapsePhase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [fixed, setFixed] = useState<{ key: string; max: number } | null>(null);

  // The latest values, read by the timer and the loader without restarting them.
  const live = useRef({ contextKey, selected, enabled });
  useEffect(() => {
    live.current = { contextKey, selected, enabled };
  });
  const timer = useRef<number | null>(null);
  const run = useRef(0); // bumped by every play and pause, so a stale loader or timer gives up
  const lastSet = useRef<YearMonth | null>(null);

  function clearTimer() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }
  useEffect(() => clearTimer, []);

  function show(month: YearMonth) {
    lastSet.current = month;
    setSelected(month);
  }

  function pause() {
    run.current++;
    clearTimer();
    setPhase("idle");
  }

  async function play() {
    if (!enabled || months.length === 0) return;
    const thisRun = ++run.current;
    const key = contextKey;
    const stillCurrent = () => run.current === thisRun && live.current.contextKey === key && live.current.enabled;
    setError(null);

    let max = fixed?.key === key ? fixed.max : null;
    if (max === null) {
      // Load every month through useGrid's own query, a few at a time.
      setPhase("loading");
      setProgress({ done: 0, total: months.length });
      const box = bbox ?? WORLD;
      const step = bbox ? undefined : WORLD_STEP;
      const queue = [...months];
      let done = 0;
      let largest = 0;
      const worker = async () => {
        for (let next = queue.shift(); next && stillCurrent(); next = queue.shift()) {
          const month = ym(next.year, next.month);
          const data = await queryClient.fetchQuery({
            queryKey: gridKey(box, month, month, step),
            queryFn: () => api.grid(box, month, month, step),
            staleTime: Infinity,
            gcTime: 30 * 60 * 1000,
          });
          largest = Math.max(largest, data.max);
          done++;
          if (stillCurrent()) setProgress({ done, total: months.length });
        }
      };
      try {
        await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, worker));
      } catch (e) {
        if (run.current === thisRun) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
          setPhase("idle");
        }
        return;
      }
      if (!stillCurrent()) {
        if (run.current === thisRun) setPhase("idle");
        return;
      }
      max = largest;
      setFixed({ key, max });
    }

    // Carry on from the selected month if it is inside the range, otherwise start at the beginning.
    const at = months.findIndex((m) => sameMonth(m, live.current.selected));
    let index = at >= 0 && at < months.length - 1 ? at : 0;
    show(months[index]);
    setPhase("playing");
    clearTimer();
    timer.current = window.setInterval(
      () => {
        // A click in the calendar, a new box or year range, or the anomaly view stops playback
        // and leaves the last month selected.
        const userPicked = !sameMonth(live.current.selected, lastSet.current);
        if (!stillCurrent() || userPicked) {
          pause();
          return;
        }
        index++;
        if (index >= months.length) {
          pause();
          return;
        }
        show(months[index]);
      },
      reducedMotion() ? REDUCED_STEP_MS : NORMAL_STEP_MS,
    );
  }

  // Dragging the timeline picks a month, and stops playback.
  function scrubTo(index: number) {
    const month = months[index];
    if (!month) return;
    if (phase !== "idle") pause();
    show(month);
  }

  const index = months.findIndex((m) => sameMonth(m, selected));
  // The fixed scale applies while one month of the loaded range is on the map.
  const scaleMax = fixed?.key === contextKey && index >= 0 ? fixed.max : null;

  return { months, index, phase, progress, error, scaleMax, play, pause, scrubTo };
}

export type TimeLapse = ReturnType<typeof useTimeLapse>;
