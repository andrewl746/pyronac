// How the harmonized numbers were made, from harmonization.json by way of /api/meta.
import type { Harmonization } from "../../api/types";
import { formatCount, formatDate } from "../../lib/format";

const METHODS: Record<Harmonization["method"], string> = {
  v0: "placeholder (v0): one VIIRS to MODIS ratio per country",
  ratio: "ratio: a VIIRS to MODIS ratio for each 1 degree block and calendar month",
  ml: "ml: a gradient boosting model that predicts the VIIRS count from what MODIS saw, with the ratio method wherever the model has no estimate",
};

// The errors in harmonization.json are fractions: 0.1354 means 13.5% off.
const percent = (fraction: number) => `${formatCount(Math.round(fraction * 1000) / 10)}%`;

export function MethodNote({ harmonization }: { harmonization: Harmonization }) {
  const { method, validation, data_through, reference } = harmonization;
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
      <p>
        <span style={{ color: "var(--text)" }}>Data through:</span> {formatDate(data_through)}.
      </p>
    </div>
  );
}
