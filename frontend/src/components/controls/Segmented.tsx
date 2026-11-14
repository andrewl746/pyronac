// A small either/or switch made of buttons. Used by the mode switch and the ramp switch.
import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode };

type Props<T extends string> = {
  label: string; // read by screen readers, for example "Counts"
  describedBy?: string; // id of a line of text that explains the switch
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ label, describedBy, options, value, onChange }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className="inline-flex overflow-hidden rounded border"
      style={{ borderColor: "var(--border)" }}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1 text-xs focus-visible:outline-offset-[-2px]"
            style={{
              background: on ? "var(--accent)" : "transparent",
              color: on ? "var(--bg)" : "var(--text)",
              fontWeight: on ? 600 : 400,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
