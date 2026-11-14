// The heading of the printed briefing (section 13, extra 6). Shown on paper only: on screen the
// same facts are in the header, the region panel and the controls, which are not printed.
import { useMeta } from "../api/hooks";
import { formatDate } from "../lib/format";
import { useStore } from "../state/store";

export function BriefingHeader() {
  const bbox = useStore((state) => state.bbox);
  const startYear = useStore((state) => state.startYear);
  const endYear = useStore((state) => state.endYear);
  const mode = useStore((state) => state.mode);
  const meta = useMeta();
  const preset = bbox
    ? meta.data?.presets.find(
        (p) =>
          p.bbox.west === bbox.west &&
          p.bbox.south === bbox.south &&
          p.bbox.east === bbox.east &&
          p.bbox.north === bbox.north,
      )
    : undefined;

  return (
    <div className="print-only briefing-title text-sm">
      <h1 className="text-xl font-semibold">Pyronac, the fire almanac: fire briefing</h1>
      {bbox ? (
        <p>
          {preset ? `${preset.name}. ` : ""}Latitude {bbox.south} to {bbox.north}, longitude {bbox.west} to {bbox.east}.
          Years {startYear} to {endYear}. Calendar counts: {mode}.
        </p>
      ) : (
        <p>No area is selected. Pick an area before printing.</p>
      )}
      {meta.data && (
        <p style={{ color: "var(--text-dim)" }}>
          NASA FIRMS hot spots from MODIS and VIIRS, on one scale. Data through {formatDate(meta.data.data_through)}.
        </p>
      )}
    </div>
  );
}
