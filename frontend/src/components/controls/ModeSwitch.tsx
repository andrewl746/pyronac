// Harmonized or Raw. Flipping this is the moment that shows what the project does.
import type { Mode } from "../../api/types";
import { useStore } from "../../state/store";
import { Segmented } from "./Segmented";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "harmonized", label: "Harmonized" },
  { value: "raw", label: "Raw" },
];

export function ModeSwitch() {
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  return (
    <div className="flex flex-col items-start gap-1">
      <Segmented label="Counts" options={OPTIONS} value={mode} onChange={setMode} />
      <p className="text-xs" style={{ color: "var(--text-dim)" }}>
        Raw is what the satellites reported: MODIS before February 2012, VIIRS after. Its jump in 2012 is the
        change of sensor, not more fire.
      </p>
    </div>
  );
}
