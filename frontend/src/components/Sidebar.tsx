import { BriefingHeader } from "./BriefingHeader";
import { Calendar } from "./calendar/Calendar";
import { ComparePanel } from "./compare/ComparePanel";
import { ModeNote } from "./controls/ModeNote";
import { YearRange } from "./controls/YearRange";
import { Downloads } from "./downloads/Downloads";
import RegionPanel from "./region/RegionPanel";
import { Summary } from "./summary/Summary";
import { TrendPanel } from "./trend/TrendPanel";

// The order of the panels, from MASTERSPEC.md section 8:
// region, years, calendar, compare, trend and summary (Yuvi, later), downloads and method note.
// The Harmonized or Raw switch and the ramp switch belong in the header (App.tsx).
// Printing the page gives these panels as a one-page briefing: see the print rules in theme.css.
export default function Sidebar() {
  return (
    <div className="briefing flex flex-col gap-5 p-4">
      <BriefingHeader />
      <div className="no-print">
        <RegionPanel />
      </div>
      <section aria-label="Years" className="no-print flex flex-col gap-2">
        <YearRange />
        <ModeNote />
      </section>
      <Calendar />
      <ComparePanel />
      <TrendPanel />
      <Summary />
      <Downloads />
    </div>
  );
}
