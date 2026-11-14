import Sidebar from "./components/Sidebar";
import MapView from "./components/map/MapView";

// Layout from MASTERSPEC.md section 8: header, the map on the left, the sidebar on the right.
export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--panel)] px-4">
        <h1 className="text-base font-semibold tracking-tight">
          Pyronac <span className="font-normal text-[var(--text-dim)]">the fire almanac</span>
        </h1>
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
