// The base planner: best-coverage sites in Canada for small fire bases (recon drones and a
// helicopter crew), worked out once in Python (pipeline/base_sites.py) and shipped as
// base_sites.json. Two parts in the night-globe layout:
// - BasesMenuEntry: a "Fire bases" section in the menu with the "Show bases" switch;
// - BasePanel: the planner's own glass panel on the left of the globe, shown while the switch is on.
// The planner is country-wide, so it is not part of the selected area's insights panel.
// Off by default; with it off, only the menu entry is added and nothing is loaded.
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
      className="btn"
      style={on ? { borderColor: "var(--accent)" } : undefined}
    >
      <span aria-hidden="true" className="bases-switch-track" data-on={on}>
        <span className="bases-switch-knob" />
      </span>
      {label}
    </button>
  );
}

// In the menu: two clicks from anywhere (open the menu, switch on).
export function BasesMenuEntry() {
  const on = useBases((s) => s.on);
  const setOn = useBases((s) => s.setOn);
  return (
    <section aria-labelledby="bases-menu-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="bases-menu-heading" className="label">
          Fire bases
        </h2>
        <Switch on={on} onChange={setOn} label="Show bases" />
      </div>
      <p className="m-0 text-[11px] text-[var(--text-faint)]">
        Best-coverage sites in Canada for small fire bases, chosen from the summer fire record near towns.
      </p>
    </section>
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

  if (!on) return null;

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

  let body;
  if (query.isError) {
    body = <p role="alert" className="m-0">Could not load the base sites: {query.error.message}</p>;
  } else if (!data || !result) {
    body = <p className="m-0 text-[var(--text-dim)]">Loading the base sites…</p>;
  } else {
    body = (
      <>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={sliderId} className="flex items-baseline justify-between">
              <span className="label">Number of bases</span>
              <span className="text-[15px] font-medium">{n}</span>
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
          <div className="flex items-center justify-between">
            <span id={`${sliderId}-reach`} className="label">
              Reach
            </span>
            {/* The choices are the reaches the file holds. */}
            <Segmented<string>
              label="Reach of each base"
              describedBy={`${sliderId}-reach`}
              options={data.reaches.map((r) => ({ value: `${r.reach_km}`, label: `${r.reach_km} km` }))}
              value={`${result.reach_km}`}
              onChange={(value) => changeReach(Number(value))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div aria-live="polite" className="flex flex-col gap-1.5">
            <p className="m-0 font-medium">{coveredSentence(data, result, n)}</p>
            <p className="m-0">{selftestSentence(data, result, n)}</p>
            <p className="m-0">{peopleSentence(result, n)}</p>
          </div>
          {sites[0] && <p className="m-0 text-[12px] text-[var(--text-dim)]">Base 1: {earlySentence(sites[0])}</p>}
        </div>
        <BaseTable
          sites={sites}
          compact
          caption={`The first ${n} candidate ${n === 1 ? "site" : "sites"}, in pick order. Click a marker on the map for its numbers.`}
        />
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[11px] text-[var(--text-faint)]">{limitsNote(data)}</p>
          <div>
            <button type="button" onClick={() => void print()} disabled={preparing} className="btn">
              {preparing ? "Preparing the base list…" : "Print base list (PDF)"}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <section
        aria-labelledby="bases-heading"
        className="glass glass-strong no-print bases-panel fixed top-[72px] left-5 z-20 flex w-[min(420px,calc(100vw-40px))] flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 id="bases-heading" className="m-0 text-[15px] font-medium">
              Fire base planner
            </h2>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--text-faint)]">Canada · best-coverage sites for small fire bases</p>
          </div>
          <button type="button" aria-label="Hide the bases" onClick={() => setOn(false)} className="icon-btn -mt-1 -mr-2">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="sheet-sections min-h-0 flex-1 overflow-y-auto px-5 pb-5">{body}</div>
      </section>
      {printing && data && result && <BasePrint data={data} result={result} count={n} mapImage={mapImage} />}
    </>
  );
}
