// The year range: two selects, limited by the months the data covers.
import { useMeta } from "../../api/hooks";
import { useStore } from "../../state/store";

const yearOf = (month: string) => Number(month.slice(0, 4)); // "2003-01" -> 2003

export function YearRange() {
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const setYears = useStore((state) => state.setYears);
  const selected = useStore((state) => state.selected);
  const setSelected = useStore((state) => state.setSelected);
  const meta = useMeta();

  // Until /api/meta answers, offer just the range already in the store.
  const first = meta.data ? yearOf(meta.data.first_month) : startYear;
  const last = meta.data ? yearOf(meta.data.last_month) : endYear;
  const years: number[] = [];
  for (let year = first; year <= last; year++) years.push(year);

  function change(nextStart: number, nextEnd: number) {
    setYears(nextStart, nextEnd);
    // A selected month that is no longer on the calendar would be invisible, so clear it.
    if (selected && (selected.year < nextStart || selected.year > nextEnd)) setSelected(null);
  }

  const selectClass = "cursor-pointer rounded border px-1.5 py-1 text-xs";
  const selectStyle = { background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <fieldset className="m-0 flex items-center gap-2 border-0 p-0 text-xs">
      <legend className="sr-only">Years</legend>
      <label className="flex items-center gap-1.5">
        <span style={{ color: "var(--text-dim)" }}>From</span>
        <select
          className={selectClass}
          style={selectStyle}
          value={startYear}
          onChange={(event) => change(Number(event.target.value), endYear)}
        >
          {years
            .filter((year) => year <= endYear)
            .map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span style={{ color: "var(--text-dim)" }}>to</span>
        <select
          className={selectClass}
          style={selectStyle}
          value={endYear}
          onChange={(event) => change(startYear, Number(event.target.value))}
        >
          {years
            .filter((year) => year >= startYear)
            .map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
        </select>
      </label>
    </fieldset>
  );
}
