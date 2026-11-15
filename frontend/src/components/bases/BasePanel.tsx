// The base planner: best-coverage sites in Canada for small fire bases (recon drones and a
// helicopter crew), worked out once in Python (pipeline/base_sites.py) and shipped as
// base_sites.json. Two parts in the night-globe layout:
// - BasesTopButton: a "Fire bases" button in the bar at the top of the map, which switches it on;
// - BasePanel: the planner's own glass panel on the left of the globe, shown while the button is on.
// The planner is country-wide, so it is not part of the selected area's insights panel.
// Off by default; with it off, only the button is added and nothing is loaded.
import { useId, useState } from "react";
import { Segmented } from "../controls/Segmented";
import { BaseTable } from "./BaseTable";
import "./bases.css";
import { reachResult, shownCount, useBaseSites } from "./data";
import { downloadBaseList } from "./pdf";
import { coveredSentence, earlySentence, limitsNote, peopleSentence, selftestSentence } from "./sentences";
import { MIN_BASES, useBases } from "./store";
import type { Reach } from "./types";

// In the bar at the top of the map, next to the view switch: one click. The bases sit over
// whichever view is showing, so this is a switch of its own and not one of the views.
export function BasesTopButton() {
  const on = useBases((s) => s.on);
  const setOn = useBases((s) => s.setOn);
  return (
    <div className="map-panel seg">
      <button type="button" aria-pressed={on} onClick={() => setOn(!on)} className="map-btn">
        Fire bases
      </button>
    </div>
  );
}

export function BasePanel() {
  const on = useBases((s) => s.on);
  const count = useBases((s) => s.count);
  const reach = useBases((s) => s.reach);
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

  async function download() {
    if (!data || !result) return;
    setPreparing(true);
    try {
      await downloadBaseList(data, result, n);
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
            <button type="button" onClick={() => void download()} disabled={preparing} className="btn">
              {preparing ? "Making the PDF…" : "Download base list (PDF)"}
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
        <div className="sheet-sections min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {/* What a base is, in general terms. No ranges or speeds: we have no source for them. */}
          <p className="m-0 text-[12px] text-[var(--text-dim)]">
            A base is a small station with recon drones carrying infrared cameras and a helicopter crew. The drones
            spot new fires early and the crew flies out to them. Reach is how far from the base that crew is expected
            to respond.
          </p>
          {body}
        </div>
      </section>
    </>
  );
}
