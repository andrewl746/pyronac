import { useMeta } from "./api/hooks";
import Menu from "./components/Menu";
import Sidebar from "./components/Sidebar";
import MapView from "./components/map/MapView";

// The wordmark: a small ember, the name and the tagline.
function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
        <defs>
          <radialGradient id="ember" cx="50%" cy="58%" r="50%">
            <stop offset="0%" stopColor="#fff4d6" />
            <stop offset="28%" stopColor="#ffc15a" />
            <stop offset="62%" stopColor="#ff6a2b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff3d1f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="10" cy="10" r="10" fill="url(#ember)" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="wordmark">Pyronac</span>
        <span className="text-[11px] text-[var(--text-dim)]">A fire record to plan with</span>
      </span>
    </span>
  );
}

// The globe fills the window. On top, as glass: the logo (top left), the map tools (top centre,
// in MapView), the menu (top right), the insights for a selected area (right), and the legend
// and time-lapse (bottom, in MapView). MASTERSPEC.md section 8 layout, reworked for the demo.
export default function App() {
  const meta = useMeta();

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <main className="absolute inset-0">
        <section aria-label="Map" className="absolute inset-0">
          <MapView />
        </section>
        <Sidebar />
      </main>
      <header className="pointer-events-none fixed top-5 left-6 z-30 flex h-9 items-center gap-3">
        <h1 className="m-0">
          <Logo />
        </h1>
        {meta.data?.data_source === "fixtures" && (
          <span
            className="pointer-events-auto rounded-[4px] border border-[var(--warn)]/50 px-2 py-0.5 text-[11px] text-[var(--warn)]"
            title="The backend is serving the small fake fixture data set, not real FIRMS data."
          >
            Test data
          </span>
        )}
        {meta.isError && <span className="text-[12px] text-[var(--warn)]">Could not reach the server.</span>}
      </header>
      <Menu />
    </div>
  );
}
