// The calendar as an SVG: one row per year (newest at the top), one column per month,
// and a last column with each year's total.
import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { CalendarMonth, Era, Mode, YearMonth } from "../../api/types";
import { scaleValue } from "../../lib/colors";
import { fireColor, fireOpacity } from "../map/fire";
import { formatCount, formatMonthYear, monthShort } from "../../lib/format";
import type { Ramp } from "../../state/store";
import { errorPercent, estimateRange, isEstimated } from "./estimate";
import type { Estimate } from "./estimate";

const LEFT = 36; // room for the year labels
const TOP = 18; // room for the month labels
const CELL_W = 24;
const CELL_H = 16;
const GAP = 2;
const BAND = 13; // extra space above a row where an era starts, for the label
const GRID_RIGHT = LEFT + 12 * CELL_W + 11 * GAP;
const WIDTH = GRID_RIGHT + 60; // the totals column
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Short labels drawn on the calendar itself. The tooltip uses the full labels from /api/meta.
const ERA_SHORT: Record<Era, string> = {
  modis: "MODIS",
  snpp: "VIIRS on Suomi NPP",
  noaa20: "VIIRS on NOAA-20",
};

type Props = {
  months: CalendarMonth[];
  mode: Mode;
  max: number; // max_harmonized or max_raw, matching mode
  ramp: Ramp;
  selected: YearMonth | null;
  onSelect: (selected: YearMonth | null) => void;
  eraLabels: Partial<Record<Era, string>>;
  estimate: Estimate | null; // the error of the months estimated from MODIS, when known
  svgId?: string; // so the downloads panel can find the SVG
};

const keyOf = (year: number, month: number) => year * 100 + month;
const cellX = (month: number) => LEFT + (month - 1) * (CELL_W + GAP);

export function CalendarGrid({ months, mode, max, ramp, selected, onSelect, eraLabels, estimate, svgId }: Props) {
  const cellRefs = useRef(new Map<number, SVGRectElement>());
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [roving, setRoving] = useState<number | null>(null);

  const layout = useMemo(() => {
    const byKey = new Map<number, CalendarMonth>();
    for (const m of months) byKey.set(keyOf(m.year, m.month), m);
    // An era starts wherever two months in a row have different eras.
    const eraStarts = months.filter((m, i) => i > 0 && months[i - 1].era !== m.era);
    const years = [...new Set(months.map((m) => m.year))].sort((a, b) => b - a);
    const rowY = new Map<number, number>();
    let y = TOP;
    for (const year of years) {
      if (eraStarts.some((m) => m.year === year)) y += BAND;
      rowY.set(year, y);
      y += CELL_H + GAP;
    }
    return { byKey, eraStarts, years, rowY, height: y };
  }, [months]);
  const { byKey, eraStarts, years, rowY, height } = layout;

  const valueOf = (m: CalendarMonth) => (mode === "harmonized" ? m.harmonized : m.raw);

  // One tab stop for the whole calendar. Arrow keys move between cells.
  const lastKey = months.length ? keyOf(months[months.length - 1].year, months[months.length - 1].month) : null;
  const selectedKey = selected ? keyOf(selected.year, selected.month) : null;
  const tabStop =
    (roving !== null && byKey.has(roving) ? roving : null) ??
    (selectedKey !== null && byKey.has(selectedKey) ? selectedKey : null) ??
    lastKey;

  function moveTo(year: number, month: number) {
    const key = keyOf(year, month);
    if (!byKey.has(key)) return;
    setRoving(key);
    cellRefs.current.get(key)?.focus();
  }

  function toggle(m: CalendarMonth) {
    const isSelected = selectedKey === keyOf(m.year, m.month);
    onSelect(isSelected ? null : { year: m.year, month: m.month });
  }

  function onKeyDown(event: KeyboardEvent<SVGRectElement>, m: CalendarMonth) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [m.year, m.month - 1],
      ArrowRight: [m.year, m.month + 1],
      ArrowUp: [m.year + 1, m.month], // newer years are higher up
      ArrowDown: [m.year - 1, m.month],
      Home: [m.year, 1],
      End: [m.year, Math.max(...MONTHS.filter((month) => byKey.has(keyOf(m.year, month))))],
    };
    if (event.key in moves) {
      event.preventDefault();
      moveTo(...moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(m);
    }
  }

  const activeKey = hovered ?? focused;
  const active = activeKey !== null ? byKey.get(activeKey) : undefined;
  const activeY = active ? (rowY.get(active.year) ?? 0) : 0;
  const tooltipBelow = activeY < 110;
  const activeRange =
    active && active.harmonized > 0 && isEstimated(estimate, active.year, active.month)
      ? { ...estimateRange(active.harmonized, estimate.error), error: estimate.error }
      : null;

  return (
    <div className="relative">
      <svg
        id={svgId}
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        role="group"
        aria-label={`Fire calendar, ${mode} hot spot counts by month. Arrow keys move between months, Enter selects one.`}
        style={{ display: "block", fontFamily: "inherit" }}
      >
        {MONTHS.map((month) => (
          <text
            key={month}
            x={cellX(month) + CELL_W / 2}
            y={11}
            textAnchor="middle"
            fontSize={9}
            style={{ fill: "var(--text-dim)" }}
          >
            {monthShort(month)}
          </text>
        ))}
        <text x={WIDTH - 2} y={11} textAnchor="end" fontSize={9} style={{ fill: "var(--text-dim)" }}>
          Total
        </text>

        {years.map((year) => {
          const y = rowY.get(year) ?? 0;
          const row = MONTHS.map((month) => byKey.get(keyOf(year, month))).filter(
            (m): m is CalendarMonth => m !== undefined,
          );
          const total = row.reduce((sum, m) => sum + valueOf(m), 0);
          return (
            <g key={year}>
              <text x={LEFT - 6} y={y + CELL_H - 4} textAnchor="end" fontSize={10} style={{ fill: "var(--text-dim)" }}>
                {year}
              </text>
              {row.map((m) => {
                const key = keyOf(m.year, m.month);
                const value = valueOf(m);
                const isSelected = selectedKey === key;
                const label =
                  `${formatMonthYear(m.year, m.month)}, ${formatCount(value)} hot spots` +
                  (m.complete ? "" : ", partial month");
                return (
                  <rect
                    key={key}
                    ref={(element) => {
                      if (element) cellRefs.current.set(key, element);
                      else cellRefs.current.delete(key);
                    }}
                    x={cellX(m.month)}
                    y={y}
                    width={CELL_W}
                    height={CELL_H}
                    rx={2}
                    role="button"
                    tabIndex={key === tabStop ? 0 : -1}
                    aria-label={label}
                    aria-pressed={isSelected}
                    aria-describedby={activeKey === key ? "calendar-tooltip" : undefined}
                    data-year={m.year}
                    data-month={m.month}
                    style={{
                      fill: value > 0 ? fireColor(scaleValue(value, max), ramp) : "var(--zero-cell)",
                      // The same light-and-fade as the map: few hot spots faint, many bright.
                      fillOpacity: value > 0 ? fireOpacity(scaleValue(value, max)) : 1,
                      stroke: isSelected ? "var(--accent)" : m.complete ? "none" : "var(--text-dim)",
                      strokeWidth: isSelected ? 2 : 1,
                      strokeDasharray: !m.complete && !isSelected ? "3 2" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setRoving(key);
                      toggle(m);
                    }}
                    onKeyDown={(event) => onKeyDown(event, m)}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered((current) => (current === key ? null : current))}
                    onFocus={() => setFocused(key)}
                    onBlur={() => setFocused((current) => (current === key ? null : current))}
                  />
                );
              })}
              <text x={WIDTH - 2} y={y + CELL_H - 4} textAnchor="end" fontSize={10} style={{ fill: "var(--text)" }}>
                {formatCount(Math.round(total * 10) / 10)}
              </text>
            </g>
          );
        })}

        {eraStarts.map((m) => {
          // A stepped line: above the older months of this row, down, then under the newer ones.
          const y = rowY.get(m.year) ?? 0;
          const top = y - GAP / 2;
          const bottom = y + CELL_H + GAP / 2;
          const stepX = cellX(m.month) - GAP / 2;
          const path =
            m.month > 1
              ? `M ${LEFT - 2} ${top} H ${stepX} V ${bottom} H ${GRID_RIGHT + 2}`
              : `M ${LEFT - 2} ${bottom} H ${GRID_RIGHT + 2}`;
          return (
            <g key={keyOf(m.year, m.month)} pointerEvents="none">
              <path d={path} fill="none" strokeWidth={1.25} style={{ stroke: "var(--text)" }} />
              <text x={GRID_RIGHT} y={y - 4} textAnchor="end" fontSize={9} style={{ fill: "var(--text-dim)" }}>
                {`${ERA_SHORT[m.era]} from ${monthShort(m.month)} ${m.year}`}
              </text>
            </g>
          );
        })}
      </svg>

      {active && (
        <div
          id="calendar-tooltip"
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded-[4px] border px-2 py-1 text-xs whitespace-nowrap"
          style={{
            background: "var(--panel-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
            left: `${((cellX(active.month) + CELL_W / 2) / WIDTH) * 100}%`,
            top: `${(((tooltipBelow ? activeY + CELL_H : activeY) / height) * 100).toFixed(3)}%`,
            transform: `translate(${active.month <= 3 ? "-15%" : active.month >= 9 ? "-70%" : "-50%"}, ${
              tooltipBelow ? "6px" : "calc(-100% - 6px)"
            })`,
          }}
        >
          <div className="font-semibold">
            {formatMonthYear(active.year, active.month)}
            {active.complete ? "" : " (partial)"}
          </div>
          <div>Harmonized: {formatCount(active.harmonized)}</div>
          {activeRange && (
            <div>
              Estimate, likely {formatCount(activeRange.low)} to {formatCount(activeRange.high)} (±
              {errorPercent(activeRange.error)})
            </div>
          )}
          <div>MODIS: {formatCount(active.modis)}</div>
          {active.viirs !== null && <div>VIIRS: {formatCount(active.viirs)}</div>}
          <div style={{ color: "var(--text-dim)" }}>{eraLabels[active.era] ?? ERA_SHORT[active.era]}</div>
        </div>
      )}
    </div>
  );
}
