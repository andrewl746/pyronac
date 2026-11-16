// On a phone the panels are sheets that cover the lower half of the screen. This button, in a
// sheet's heading, makes the sheet taller or brings it back. Hidden in a wide window (layout.css).
type Props = { tall: boolean; onChange: (tall: boolean) => void };

export function SheetSize({ tall, onChange }: Props) {
  return (
    <button
      type="button"
      aria-label={tall ? "Make this panel shorter" : "Make this panel taller"}
      onClick={() => onChange(!tall)}
      className="icon-btn sheet-size -mt-1"
    >
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
        <path
          d={tall ? "M2.5 4.5 6 8l3.5-3.5" : "M2.5 7.5 6 4l3.5 3.5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
