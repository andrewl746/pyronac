import { useMeta } from "./api/hooks";
import Sidebar from "./components/Sidebar";
import MapView from "./components/map/MapView";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-11-06" -> "6 Nov 2026"
function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

// Layout from MASTERSPEC.md section 8: header, the map on the left, the sidebar on the right.
export default function App() {
  const meta = useMeta();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--panel)] px-4">
        <h1 className="text-base font-semibold tracking-tight">
          Pyronac <span className="font-normal text-[var(--text-dim)]">the fire almanac</span>
        </h1>
        {meta.data && (
          <span className="tabular-nums text-sm text-[var(--text-dim)]">
            data through {shortDate(meta.data.data_through)}
          </span>
        )}
        {meta.data?.data_source === "fixtures" && (
          <span
            className="rounded border border-[var(--accent)]/60 px-1.5 py-0.5 text-xs text-[var(--accent)]"
            title="The backend is serving the small fake fixture data set, not real FIRMS data."
          >
            Test data
          </span>
        )}
        {meta.isError && <span className="text-sm text-[var(--accent)]">Could not reach the server.</span>}
        {/* Sam's controls (Harmonized or Raw, ramp) go at the right end of the header. */}
      </header>
      <main className="flex min-h-0 flex-1">
        <section aria-label="Map" className="relative min-w-0 flex-1 bg-black">
          <MapView />
        </section>
        <aside
          aria-label="Details"
          className="w-[440px] shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--panel)]"
        >
          <Sidebar />
        </aside>
      </main>
    </div>
  );
}
