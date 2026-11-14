import { Calendar } from "./calendar/Calendar";
import { ComparePanel } from "./compare/ComparePanel";
import { ModeNote } from "./controls/ModeNote";
import { YearRange } from "./controls/YearRange";
import { Downloads } from "./downloads/Downloads";
import RegionPanel from "./region/RegionPanel";

// The order of the panels, from MASTERSPEC.md section 8:
// region, years, calendar, compare, trend and summary (Yuvi, later), downloads and method note.
// The Harmonized or Raw switch and the ramp switch belong in the header (App.tsx).
export default function Sidebar() {
  return (
    <div className="flex flex-col gap-5 p-4">
      <RegionPanel />
      <section aria-label="Years" className="flex flex-col gap-2">
        <YearRange />
        <ModeNote />
      </section>
      <Calendar />
      <ComparePanel />
      <Downloads />
    </div>
  );
}
