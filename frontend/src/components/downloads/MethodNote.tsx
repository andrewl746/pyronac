// How the harmonized numbers were made, from harmonization.json by way of /api/meta.
import type { Harmonization } from "../../api/types";
import { formatDate } from "../../lib/format";

const METHODS: Record<Harmonization["method"], string> = {
  v0: "placeholder (v0): one VIIRS to MODIS ratio per country",
  ratio: "ratio: a VIIRS to MODIS ratio for each 1 degree block and calendar month",
  ml: "ml: a gradient boosting model that predicts the VIIRS count from what MODIS saw",
};

const years = (pair: [number, number]) => `${pair[0]} to ${pair[1]}`;

export function MethodNote({ harmonization }: { harmonization: Harmonization }) {
  const { method, validation, train_years, test_years, data_through, reference } = harmonization;
  return (
    <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-dim)" }}>
      <p>
        <span style={{ color: "var(--text)" }}>Method:</span> {METHODS[method]}. Counts are on the scale of {reference}.
      </p>
      {validation ? (
        <p>
          <span style={{ color: "var(--text)" }}>Validation:</span> {validation.metric}: raw {validation.raw_error},
          harmonized {validation.harmonized_error}
          {train_years && test_years ? ` (learned on ${years(train_years)}, tested on ${years(test_years)})` : ""}.
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
