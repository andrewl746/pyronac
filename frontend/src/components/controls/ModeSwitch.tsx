// Harmonized or Raw. Flipping this is the moment that shows what the project does.
// The switch is compact so it fits the header; ModeNote is the line that explains raw.
import type { Mode } from "../../api/types";
import { useStore } from "../../state/store";
import { MODE_NOTE_ID } from "./ModeNote";
import { Segmented } from "./Segmented";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "harmonized", label: "Harmonized" },
  { value: "raw", label: "Raw" },
];

export function ModeSwitch() {
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  return <Segmented label="Counts" describedBy={MODE_NOTE_ID} options={OPTIONS} value={mode} onChange={setMode} />;
}
