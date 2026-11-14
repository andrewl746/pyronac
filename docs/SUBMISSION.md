# Submission text: Pyronac, the fire almanac

Draft by Sam, Saturday 14 November 2026. Every field on the Space Apps project page is below
(MASTERSPEC.md section 14). Lines marked **TODO** still need a person. Numbers come from
`docs/METHOD.md` as it stood on Saturday midday and must be checked against it again before
submitting, because the method and the data are still changing.

Everyone on the team reads the final text before it is submitted.

## Project name

Pyronac, the fire almanac

## High-level summary

Satellites have recorded fires as "hot spots" since 2000, first with MODIS and since 2012 with
VIIRS, which has smaller pixels and reports several times more hot spots for the same fire. Counted
as reported, Canada's fire record jumps about fivefold between 2011 and 2012 although nothing changed
on the ground. Pyronac harmonizes the two records into one, on the scale of VIIRS on Suomi NPP, and
shows it as a calendar of burning activity from 2003 to 2025 for any area the user picks on a globe.
On six years the method never saw, the typical error of a monthly total falls from about 80% for raw
MODIS to about 14% after harmonization. An emergency manager can ask "is this October unusual here?"
and get an answer that does not depend on which satellite was flying.

**TODO (Yuvi, Andrew L):** change "2003 to 2025" to "2003 to this month" only when real 2026 data
is served and checked in the app.

## Link to project demo

**TODO (Sam, Andrew L):** a video of 30 seconds or less, or at most 7 slides, on a public link that
needs no login. Going over either limit makes the project ineligible for global judging.

## Link to final project

- Repository: https://github.com/andrewl746/pyronac (public, checked Saturday 12:25).
- Live site: **TODO**, only if the deploy extra is done. Otherwise leave it out.

## Detailed description

### What it does

- **Pick an area.** The app opens on a globe with burned cells marked. The user clicks a preset such
  as the Northwest Territories, types latitude and longitude, or draws a box.
- **Read the calendar.** One row per year and one column per month, 2003 to 2025
  (**TODO:** 2026 once it is served and checked). Colour shows how
  many hot spots, on a log scale, with a legend in real counts. Big fire years such as 2014 and 2023
  stand out.
- **See the problem and the fix.** A switch flips between "Harmonized" and "Raw". In raw mode the
  years from 2012 on look several times busier than the years before, because of the sensor change.
  In harmonized mode that false jump is gone.
- **Compare a month with its history.** A panel puts any month beside the same calendar month in
  every other year: the median, the usual range, the rank, and a sentence such as "July 2023 was
  1,244% above the usual July here" for the Northwest Territories.
- **TODO (Yuvi, Andrew L): the second handoff.** Suomi NPP stopped delivering data on 2 November
  2026. The method for carrying the record on with NOAA-20 is built and its ratio is measured
  (0.997 over April 2018 to October 2025), but the app serves data only through 31 December 2025.
  Do not claim that the record continues across the handoff until real November 2026 data is built,
  served and checked in the app. Then replace this bullet with: "Follow the second handoff. From
  November 2026 the record continues on NOAA-20, scaled by a ratio measured while both satellites
  flew."
- **Take the data away.** The hot spots for the area and dates download as a CSV, the calendar as a
  CSV, and the calendar and the comparison chart as PNG images.

- **See what is unusual on the map.** An "Anomaly" view colours each cell by how unusual the selected
  month is against the same calendar month in other years.

**TODO (Sam):** add the trend chart and the plain-language summary here once they are merged (pull
request #27). The wording must follow the real numbers: for all of Canada, 2003 to 2025, both
records rise, the harmonized one by 83% a decade and the raw one by 129%. So say that the raw record
overstates the rise, not that harmonizing removes it.

### How it works

- **Data.** NASA FIRMS active fire detections for Canada: MODIS from 2003, VIIRS on Suomi NPP from
  2012, VIIRS on NOAA-20 from 2018. Low-confidence detections and non-vegetation sources are dropped.
  **TODO (Yuvi):** say whether 2026, India and Brazil are in the final build.
- **Grid.** Detections are counted per month in cells of 0.1 by 0.1 degree. Every number in the app
  is a sum over whole cells, so the map, the calendar, the comparison and the downloads always agree.
- **Harmonization.** Every month is put on the scale of VIIRS on Suomi NPP. From February 2012 to
  October 2026 the record is Suomi NPP as observed. Before that, a gradient boosting model estimates
  what Suomi NPP would have reported from what MODIS saw (count, fire radiative power, place, season
  and neighbouring cells). Where the model has no estimate, a ratio per 1 degree block and calendar
  month is used. From November 2026 the record is designed to be NOAA-20 times a handoff ratio
  (**TODO:** not yet checked on a real month, see above).
- **App.** A Python pipeline with DuckDB writes Parquet tables. A FastAPI server reads them. The
  frontend is React and TypeScript with a MapLibre globe.

### Validation

The conversion is learned on 2012 to 2019 only and tested on 2020 to 2025, years it never saw, by
comparing the estimate from MODIS with what Suomi NPP really reported. The error is the median
absolute percentage error of Canada's totals.

| Method, tested on 2020 to 2025 | Monthly totals | Yearly totals |
|---|---|---|
| Raw MODIS | 79.9% | 80.8% |
| Ratio method | 18.1% | 9.9% |
| ML model (used in the app) | 13.5% | 1.6% |

**TODO (Andrew L):** confirm these are the final numbers, and add one sentence on what is weakest
(2024 is the one year far off, at +14.8%).

### Benefits

- Fire managers and researchers get one consistent record of more than two decades instead of two
  records that cannot be compared.
- "Unusual" is measured against the same place and the same calendar month, on the same scale.
- The record is built not to break when a satellite stops delivering data. Suomi NPP stopped
  delivering data on 2 November 2026, and the move to NOAA-20 is handled the same way as the move
  from MODIS to VIIRS. **TODO (Yuvi, Andrew L):** keep this bullet only once real November 2026
  data is served and checked.
- The method is simple to explain and its error is measured and shown in the app.

### Accessibility

- Two colour ramps, both readable with colour vision deficiency (inferno and cividis).
- Every value is available as a number: legends with real counts, tooltips on hover (and on
  keyboard focus in the calendar), a table view of the calendar, and a sentence for the comparison.
- Everything works by keyboard, with a visible focus ring. Text contrast is at least 4.5 to 1.

### Tools and languages

Python, DuckDB, pandas, scikit-learn, FastAPI, TypeScript, React, Vite, MapLibre GL JS, Recharts,
Tailwind CSS, d3-scale-chromatic, Zustand, TanStack Query.

## Use of AI tools

The form calls this "SI". Source: `docs/AI_USE.md`, which has one row per working session with the
time, the person, the tool, what it produced and how it was checked.

- AI coding assistants (Claude Code and OpenAI Codex) wrote most of the code and the first drafts
  of the documentation, including this text, working from a specification the team wrote.
- The idea, the choice of method and the decisions between options are the team's.
- No images, video or audio were made with AI. **TODO:** change this line if that stops being true;
  anything of that kind needs a visible watermark.
- Nothing AI-generated contains NASA logos, flags or mission identifiers.

**TODO (everyone):** check `docs/AI_USE.md` has a row from every teammate (check E2), then copy a
short version of it here. On Saturday 13:00 it had rows from everyone except Yuvi, all naming
Claude Code. Yuvi's use of OpenAI Codex is stated in pull request #18 and still needs its row.

## NASA data

- FIRMS MODIS Collection 6.1 active fire detections (Terra and Aqua), 1 km.
- FIRMS VIIRS 375 m active fire detections from Suomi NPP.
- FIRMS VIIRS 375 m active fire detections from NOAA-20.

Links:

- NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/
- Yearly country files: https://firms.modaps.eosdis.nasa.gov/data/country/
- Archive download (2026): https://firms.modaps.eosdis.nasa.gov/download/

**TODO (Yuvi):** add the exact download dates from `docs/DATA_NOTES.md` and the data citations FIRMS
asks for.

## Other references

- Challenge: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots
- MapLibre GL JS, the map library.
- Base map imagery: Sentinel-2 cloudless 2024 by EOX IT Services GmbH (contains modified Copernicus
  Sentinel data 2024), https://s2maps.eu. Borders and labels: OpenFreeMap, © OpenMapTiles, data from
  OpenStreetMap. **TODO (Vlad):** confirm this is still the base map in the final build.
- DuckDB, FastAPI, uvicorn, NumPy, SciPy, pandas, PyArrow, scikit-learn, httpx.
- React, Vite, TypeScript, Tailwind CSS, Recharts, d3-scale-chromatic (inferno and cividis ramps),
  Zustand, TanStack Query.

**TODO (Sam):** before submitting, compare this list with `backend/requirements.txt`,
`pipeline/requirements.txt` and `frontend/package.json`, so every library used is named.

## Before pressing submit

- [ ] Every **TODO** above is gone.
- [ ] The numbers match `docs/METHOD.md` and the method note in the app.
- [ ] The demo is 30 seconds or less, or at most 7 slides.
- [ ] Every link opens in a private browser window with no login.
- [ ] Everyone on the team has read the text.
- [ ] "Terms and Conditions" and "Confirm All Work is Original" are ticked, then "Submit for Judging".
