# AI use

Every teammate adds a row after each working session (MASTERSPEC.md section 9).

| Time | Who | Tool | What it produced | How a person checked it |
|---|---|---|---|---|
| 2026-11-14 11:00–11:31 EST | Vlad | Claude Code (Claude Opus 5.5) | Frontend scaffold and config; `src/api/hooks.ts`; `src/lib/geo.ts`; `src/components/map/` (satellite globe, red-hatched fire cells, legend, draw tool, loading and error states); `src/components/region/RegionPanel.tsx`; header in `App.tsx` | Build, lint, the `snapBbox` check and U1 to U4 run by the assistant, with headless Chrome screenshots of each step. Vlad to review in the browser before pushing. |
| 2026-11-14 10:50–12:30 EST | Sam | Claude Code (Claude Fable 5.2) | `src/theme.css`; `src/lib/colors.ts`, `format.ts`, `download.ts`; `src/components/calendar/`, `controls/`, `compare/`, `downloads/`; the panel order in `Sidebar.tsx`; the header switches proposed for `App.tsx` (pull request #12); fixes for issues #8 (clipped focus ring) and #9 (validation shown as percentages); the pull request descriptions | Build, lint and each step's check run by the assistant in headless Chrome, on the mock API and on the backend with fixtures; outputs are in pull requests #1 to #5 and #11 to #13. The assistant looked at screenshots and the downloaded PNG and CSV files. Sam to review in the browser. |
