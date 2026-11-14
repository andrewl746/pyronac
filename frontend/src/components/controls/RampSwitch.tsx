// Choice of colour ramp. Both ramps are readable with colour vision deficiency.
import { rampStops } from "../../lib/colors";
import { useStore } from "../../state/store";
import type { Ramp } from "../../state/store";
import { Segmented } from "./Segmented";

const NAMES: Record<Ramp, string> = { fire: "Fire", cividis: "Cividis" };

function Swatch({ ramp }: { ramp: Ramp }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-6 rounded-sm"
      style={{ background: `linear-gradient(to right, ${rampStops(ramp, 5).join(", ")})`, outline: "1px solid var(--border)" }}
    />
  );
}

const OPTIONS = (Object.keys(NAMES) as Ramp[]).map((ramp) => ({
  value: ramp,
  label: (
    <>
      <Swatch ramp={ramp} />
      {NAMES[ramp]}
    </>
  ),
}));

export function RampSwitch() {
  const ramp = useStore((state) => state.ramp);
  const setRamp = useStore((state) => state.setRamp);
  return <Segmented label="Colour ramp" options={OPTIONS} value={ramp} onChange={setRamp} />;
}
