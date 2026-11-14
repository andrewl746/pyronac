// The short line that explains what raw means. It sits in the sidebar, above the calendar.

// The mode switch points at this id, so screen readers read the line with the switch.
export const MODE_NOTE_ID = "mode-note";

export function ModeNote() {
  return (
    <p id={MODE_NOTE_ID} className="text-xs" style={{ color: "var(--text-dim)" }}>
      Raw is what the satellites reported: MODIS before February 2012, VIIRS after. Its jump in 2012 is the change of
      sensor, not more fire.
    </p>
  );
}
