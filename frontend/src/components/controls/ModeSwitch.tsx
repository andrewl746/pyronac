// Harmonized or Raw, as one switch: on means the counts are harmonized across the 2012 change of
// sensor (the default), off means raw, as the satellites reported them. ModeNote explains raw.
import { useStore } from "../../state/store";
import { MODE_NOTE_ID, ModeNote, RAW_NOTE } from "./ModeNote";

export function ModeSwitch() {
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  const on = mode === "harmonized";
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span id="mode-switch-label" className="text-[13px] text-[var(--text)]">
          Match the sensors
        </span>
        <span className="text-[11px] leading-snug text-[var(--text-faint)]" title={RAW_NOTE}>
          {on
            ? "Counts before 2012 (MODIS) are put on today's VIIRS scale, so the 2012 switch is not a jump."
            : "Raw counts, as each satellite reported them."}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="mode-switch-label"
        aria-describedby={MODE_NOTE_ID}
        onClick={() => setMode(on ? "raw" : "harmonized")}
        className="relative mt-0.5 h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full transition-colors"
        style={{ background: on ? "var(--accent)" : "rgba(255, 255, 255, 0.14)" }}
      >
        <span
          aria-hidden="true"
          className="absolute top-[3px] left-[3px] block h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(16px)" : "none", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
        />
      </button>
      <ModeNote />
    </div>
  );
}
