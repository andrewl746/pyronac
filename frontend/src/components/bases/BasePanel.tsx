// The base planner: best-coverage sites in Canada for small fire bases (recon drones and a
// helicopter crew), worked out once in Python (pipeline/base_sites.py) and shipped as
// base_sites.json. Off by default; with it off, only this heading and switch are added.
import { useId, useState } from "react";
import { Segmented } from "../controls/Segmented";
import { BasePrint } from "./BasePrint";
import { BaseTable } from "./BaseTable";
import "./bases.css";
import { reachResult, shownCount, useBaseSites } from "./data";
import { printBaseList } from "./print";
import { coveredSentence, earlySentence, limitsNote, peopleSentence, selftestSentence } from "./sentences";
import { MIN_BASES, useBases } from "./store";
import type { Reach } from "./types";

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs"
      style={{ borderColor: on ? "var(--accent)" : "var(--border)", color: "var(--text)" }}
    >
      <span
        aria-hidden="true"
        className="relative inline-block h-3.5 w-6 rounded-full transition-colors"
        style={{ background: on ? "var(--accent)" : "var(--zero-cell)", border: "1px solid var(--border)" }}
      >
        <span
          className="absolute top-px h-2.5 w-2.5 rounded-full transition-all"
          style={{ left: on ? "11px" : "1px", background: on ? "var(--bg)" : "var(--text-dim)" }}
        />
      </span>
      {label}
    </button>
  );
}

export function BasePanel() {
  const on = useBases((s) => s.on);
  const count = useBases((s) => s.count);
  const reach = useBases((s) => s.reach);
  const printing = useBases((s) => s.printing);
  const mapImage = useBases((s) => s.mapImage);
  const setOn = useBases((s) => s.setOn);
  const setCount = useBases((s) => s.setCount);
  const setReach = useBases((s) => s.setReach);
  const [preparing, setPreparing] = useState(false);
  const sliderId = useId();

  const query = useBaseSites(on);
  const data = query.data;
  const result = reachResult(data, reach);
  const n = result ? shownCount(count, result) : count;
  const sites = result ? result.sites.slice(0, n) : [];

  // A shorter list for the new reach brings the number down to its length.
  function changeReach(next: Reach) {
    setReach(next);
    const length = reachResult(data, next)?.sites.length;
    if (length !== undefined && count > length) setCount(length);
  }

  async function print() {
    if (!result) return;
    setPreparing(true);
    try {
      await printBaseList(sites, result.reach_km);
    } finally {
      setPreparing(false);
    }
  }

  let body = null;
  if (on) {
    if (query.isError) {
      body = <p role="alert">Could not load the base sites: {query.error.message}</p>;
    } else if (!data || !result) {
      body = <p style={{ color: "var(--text-dim)" }}>Loading the base sites…</p>;
    } else {
      body = (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={sliderId} className="flex items-baseline justify-between text-xs">
              <span>Number of bases</span>
              <span className="text-sm font-semibold">{n}</span>
            </label>
            <input
              id={sliderId}
              type="range"
              min={MIN_BASES}
              max={result.sites.length}
              step={1}
              value={n}
              onChange={(e) => setCount(Number(e.target.value))}
              aria-valuetext={n === 1 ? "1 base" : `${n} bases`}
              className="bases-slider w-full"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span id={`${sliderId}-reach`}>Reach</span>
            {/* The choices are the reaches the file holds. */}
            <Segmented<string>
              label="Reach of each base"
              describedBy={`${sliderId}-reach`}
              options={data.reaches.map((r) => ({ value: `${r.reach_km}`, label: `${r.reach_km} km` }))}
              value={`${result.reach_km}`}
              onChange={(value) => changeReach(Number(value))}
            />
          </div>
          <div aria-live="polite" className="flex flex-col gap-1.5">
            <p className="font-semibold">{coveredSentence(data, result, n)}</p>
            <p>{selftestSentence(data, result, n)}</p>
            <p>{peopleSentence(result, n)}</p>
          </div>
          {sites[0] && (
            <p style={{ color: "var(--text-dim)" }}>
              Base 1: {earlySentence(sites[0])}
            </p>
          )}
          <BaseTable
            sites={sites}
            scroll
            caption={`The first ${n} candidate ${n === 1 ? "site" : "sites"}, in pick order. Click a marker on the map for its numbers.`}
          />
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            {limitsNote(data)}
          </p>
          <div>
            <button
              type="button"
              onClick={() => void print()}
              disabled={preparing}
              className="cursor-pointer rounded border px-2.5 py-1 text-xs disabled:cursor-default disabled:opacity-60"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              {preparing ? "Preparing the base list…" : "Print base list (PDF)"}
            </button>
          </div>
        </>
      );
    }
  }

  return (
    <>
      <section aria-labelledby="bases-heading" className="no-print flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 id="bases-heading" className="text-sm font-semibold">
            Fire base planner <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(Canada)</span>
          </h2>
          <Switch on={on} onChange={setOn} label="Show bases" />
        </div>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          Best-coverage sites for small fire bases, chosen from the summer fire record near towns.
        </p>
        {body}
      </section>
      {printing && data && result && <BasePrint data={data} result={result} count={n} mapImage={mapImage} />}
    </>
  );
}
