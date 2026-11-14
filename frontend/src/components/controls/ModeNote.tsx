// The short line that explains what raw means. It is the hover text of the Raw switch in the header,
// and a visually hidden line next to the switch, so screen readers still read it with the switch.

// The mode switch points at this id.
export const MODE_NOTE_ID = "mode-note";

export const RAW_NOTE =
  "Raw is what the satellites reported: MODIS before February 2012, VIIRS after. Its jump in 2012 is the change of sensor, not more fire.";

export function ModeNote() {
  return (
    <span id={MODE_NOTE_ID} className="sr-only">
      {RAW_NOTE}
    </span>
  );
}
