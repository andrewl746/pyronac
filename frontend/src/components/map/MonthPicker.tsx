import { useMeta } from "../../api/hooks";
import type { YearMonth } from "../../api/types";
import { monthName } from "../../lib/format";
import { useStore } from "../../state/store";
import { parseYearMonth, ym } from "./labels";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SELECT_CLASS =
  "field";

// Which month the map shows: the whole year range, or one month. It sets `selected` in the store,
// like a click in the calendar, so the calendar, the compare panel and the time-lapse follow.
export default function MonthPicker() {
  const meta = useMeta();
  const startYear = useStore((s) => s.startYear);
  const endYear = useStore((s) => s.endYear);
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);

  const first = parseYearMonth(meta.data?.first_month);
  const last = parseYearMonth(meta.data?.last_month);
  if (!meta.data || !first || !last) return null;
  const firstKey = meta.data.first_month;
  const lastKey = meta.data.last_month;

  // The years of the year range that have data, newest first, as in the calendar.
  const fromYear = Math.max(startYear, first.year);
  const toYear = Math.min(endYear, last.year);
  const years: number[] = [];
  for (let y = toYear; y >= fromYear; y--) years.push(y);
  if (years.length === 0) return null;

  const year = selected?.year ?? toYear;
  const hasData = (y: number, m: number) => ym(y, m) >= firstKey && ym(y, m) <= lastKey;
  // A month with no data yet (for example December of the current year) moves to the nearest one.
  const keepInData = (y: number, m: number): YearMonth => {
    if (ym(y, m) < firstKey) return first;
    if (ym(y, m) > lastKey) return last;
    return { year: y, month: m };
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="mr-0.5 text-[var(--text-dim)]">Showing</span>
      <label>
        <span className="sr-only">Month shown on the map</span>
        <select
          className={SELECT_CLASS}
          value={selected ? String(selected.month) : ""}
          onChange={(e) =>
            setSelected(e.target.value === "" ? null : keepInData(year, Number(e.target.value)))
          }
        >
          <option value="">Whole period</option>
          {MONTHS.map((m) => (
            <option key={m} value={m} disabled={!hasData(year, m)}>
              {monthName(m)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Year shown on the map</span>
        <select
          className={SELECT_CLASS}
          value={String(year)}
          disabled={!selected}
          title={selected ? undefined : "Pick a month first"}
          onChange={(e) => selected && setSelected(keepInData(Number(e.target.value), selected.month))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
