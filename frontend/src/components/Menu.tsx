import { useEffect, useRef, useState } from "react";
import { useMeta } from "../api/hooks";
import { formatDate } from "../lib/format";
import { ModeSwitch } from "./controls/ModeSwitch";
import { RampSwitch } from "./controls/RampSwitch";
import { YearRange } from "./controls/YearRange";
import { Downloads } from "./downloads/Downloads";

// The menu: a round button top right that opens a glass drawer with the settings and the extras
// that are not needed on screen all the time: counts, palette, years, downloads, the method note.
export default function Menu() {
  const [open, setOpen] = useState(false);
  const meta = useMeta();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Escape closes the drawer and gives focus back to the button; opening moves focus inside.
  useEffect(() => {
    if (!open) return;
    drawerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="menu-drawer"
        onClick={() => setOpen((o) => !o)}
        className="glass icon-btn no-print fixed top-5 right-5 z-40 h-9! w-9! rounded-full!"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
          {open ? (
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          ) : (
            <path d="M2 4.5h10M2 9.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="menu-drawer"
          ref={drawerRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Settings and downloads"
          className="glass glass-strong sheet-in no-print fixed top-[68px] right-5 z-30 flex max-h-[calc(100vh-104px)] w-[min(360px,calc(100vw-40px))] flex-col overflow-y-auto p-5 outline-none"
        >
          <div className="sheet-sections">
            <section aria-labelledby="counts-heading" className="flex flex-col gap-3">
              <h2 id="counts-heading" className="label">
                Counts
              </h2>
              <ModeSwitch />
            </section>
            <section aria-labelledby="palette-heading" className="flex items-center justify-between">
              <h2 id="palette-heading" className="label">
                Palette
              </h2>
              <RampSwitch />
            </section>
            <section aria-labelledby="years-heading" className="flex items-center justify-between">
              <h2 id="years-heading" className="label">
                Years
              </h2>
              <YearRange />
            </section>
            <Downloads />
            <p className="m-0 text-[11px] text-[var(--text-faint)]">
              Hot spots from NASA FIRMS (MODIS and VIIRS).
              {meta.data && ` Updated ${formatDate(meta.data.data_through)}.`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
