# AI use

Every teammate adds a row after each working session (MASTERSPEC.md section 9).

| Time | Who | Tool | What it produced | How a person checked it |
|---|---|---|---|---|
| 2026-11-14 11:00–11:31 EST | Vlad | Claude Code (Claude Opus 5.5) | Frontend scaffold and config; `src/api/hooks.ts`; `src/lib/geo.ts`; `src/components/map/` (satellite globe, red-hatched fire cells, legend, draw tool, loading and error states); `src/components/region/RegionPanel.tsx`; header in `App.tsx` | Build, lint, the `snapBbox` check and U1 to U4 run by the assistant, with headless Chrome screenshots of each step. Vlad to review in the browser before pushing. |
