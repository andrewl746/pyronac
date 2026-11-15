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
      <div className={row}>
        <dt className="text-[var(--text-faint)]">Data through</dt>
        <dd className="m-0 text-[var(--text)]">{formatDate(data_through)}</dd>
      </div>
    </dl>
  );
}
