// How the harmonized numbers were made, from harmonization.json by way of /api/meta.
import type { Harmonization, MetaResponse } from "../../api/types";
import { formatDate, formatMonthYear } from "../../lib/format";

const METHODS: Record<Harmonization["method"], string> = {
  v0: "placeholder (v0): one VIIRS to MODIS ratio per country",
  ratio: "ratio: a VIIRS to MODIS ratio for each 1 degree block and calendar month",
  ml: "ml: the VIIRS count is estimated from what MODIS saw, by a gradient boosting model where that tested better and by the ratio method elsewhere",
};

// The errors in harmonization.json are fractions: 0.1354 means 13.5% off.
const percent = (fraction: number) => `${(Math.round(fraction * 1000) / 10).toFixed(1)}%`;

// "2026-11" -> "November 2026"
const monthText = (month: string) => formatMonthYear(Number(month.slice(0, 4)), Number(month.slice(5, 7)));

type Props = { harmonization: Harmonization; eras: MetaResponse["eras"]; lastMonth: string };

export function MethodNote({ harmonization, eras, lastMonth }: Props) {
  const { method, validation, data_through, reference, handoff_ratio_noaa20 } = harmonization;
  // The second handoff, shown once the data reaches the first NOAA-20 month.
  const noaa20From = eras.find((era) => era.id === "noaa20")?.from; // "2026-11"
  const handoff = noaa20From !== undefined && lastMonth >= noaa20From ? monthText(noaa20From) : null;
  const row = "grid grid-cols-[72px_1fr] gap-3";
  return (
    <dl className="m-0 mt-1 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
      <div className={row}>
        <dt className="text-[var(--text-faint)]">Method</dt>
        <dd className="m-0">
          {METHODS[method]}. Counts are on the scale of {reference}.
        </dd>
      </div>
      <div className={row}>
        <dt className="text-[var(--text-faint)]">Validation</dt>
        <dd className="m-0">
          {validation ? (
            <>
              raw MODIS <span className="text-[var(--text)]">{percent(validation.raw_error)}</span> off, harmonized{" "}
              <span className="text-[var(--text)]">{percent(validation.harmonized_error)}</span> off ({validation.metric}).
            </>
          ) : (
            "not run yet for this method."
          )}
        </dd>
      </div>
      {handoff && (
        <div className={row}>
          <dt className="text-[var(--text-faint)]">Handoff</dt>
          <dd className="m-0">
            Suomi NPP stopped delivering data on 2 November 2026. From {handoff} the record comes from VIIRS on
            NOAA-20, scaled to match Suomi NPP (ratio {handoff_ratio_noaa20.toFixed(2)}).
          </dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-[var(--text-faint)]">Data through</dt>
        <dd className="m-0 text-[var(--text)]">{formatDate(data_through)}</dd>
      </div>
    </dl>
  );
}
