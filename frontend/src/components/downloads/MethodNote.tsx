// How the harmonized numbers were made, from harmonization.json by way of /api/meta.
import type { Harmonization, MetaResponse } from "../../api/types";
import { formatCount, formatDate, formatMonthYear } from "../../lib/format";

const METHODS: Record<Harmonization["method"], string> = {
  v0: "placeholder (v0): one VIIRS to MODIS ratio per country",
  ratio: "ratio: a VIIRS to MODIS ratio for each 1 degree block and calendar month",
  ml: "ml: the VIIRS count is estimated from what MODIS saw, by a gradient boosting model where that tested better and by the ratio method elsewhere",
};

// The errors in harmonization.json are fractions: 0.1354 means 13.5% off.
const percent = (fraction: number) => `${formatCount(Math.round(fraction * 1000) / 10)}%`;

// "2026-11" -> "November 2026"
const monthText = (month: string) => formatMonthYear(Number(month.slice(0, 4)), Number(month.slice(5, 7)));

type Props = { harmonization: Harmonization; eras: MetaResponse["eras"]; lastMonth: string };

export function MethodNote({ harmonization, eras, lastMonth }: Props) {
  const { method, validation, data_through, reference, handoff_ratio_noaa20 } = harmonization;
  // The second handoff, shown once the data reaches the first NOAA-20 month.
  const noaa20From = eras.find((era) => era.id === "noaa20")?.from; // "2026-11"
  const handoff = noaa20From !== undefined && lastMonth >= noaa20From ? monthText(noaa20From) : null;
  return (
    <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-dim)" }}>
      <p>
        <span style={{ color: "var(--text)" }}>Method:</span> {METHODS[method]}. Counts are on the scale of {reference}.
      </p>
      {validation ? (
        <p>
          <span style={{ color: "var(--text)" }}>Validation:</span> raw MODIS {percent(validation.raw_error)} off,
          harmonized {percent(validation.harmonized_error)} off ({validation.metric}).
        </p>
      ) : (
        <p>
          <span style={{ color: "var(--text)" }}>Validation:</span> not run yet for this method.
        </p>
      )}
      {handoff && (
        <p>
          <span style={{ color: "var(--text)" }}>Satellite handoff:</span> Suomi NPP stopped delivering data on 2
          November 2026. From {handoff} the record comes from VIIRS on NOAA-20, scaled to match Suomi NPP (ratio{" "}
          {handoff_ratio_noaa20.toFixed(2)}).
        </p>
      )}
      <p>
        <span style={{ color: "var(--text)" }}>Data through:</span> {formatDate(data_through)}.
      </p>
    </div>
  );
}
