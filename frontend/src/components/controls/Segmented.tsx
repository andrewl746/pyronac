// A small either/or switch made of buttons. Used by the mode switch and the ramp switch.
import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode; title?: string }; // title: hover text

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
      className="segmented inline-flex h-[30px] overflow-hidden rounded-[4px] p-[3px]"
      style={{ background: "rgba(255, 255, 255, 0.05)" }}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            title={option.title}
            onClick={() => onChange(option.value)}
            className="segmented-option flex cursor-pointer items-center gap-1.5 rounded-[4px] px-3 text-[12px] transition-colors"
            style={{
              background: on ? "rgba(255, 255, 255, 0.13)" : "transparent",
              color: on ? "var(--text)" : "var(--text-dim)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
