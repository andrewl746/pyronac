# Submission text: Pyronac, the fire almanac

Draft by Sam, Saturday 14 November 2026, updated Saturday afternoon after the full data build was
published. Every field on the Space Apps project page is below (MASTERSPEC.md section 14). Lines
marked **TODO** still need a person. Numbers come from `docs/METHOD.md`, `docs/DATA_NOTES.md` and the
app running on the published build (data through 14 November 2026). Check them again before
submitting, because the method and the data can still change.

Everyone on the team reads the final text before it is submitted.

## Project name

Pyronac, the fire almanac

## High-level summary

Satellites have recorded fires as "hot spots" since 2000, first with MODIS and since 2012 with
VIIRS, which has smaller pixels and reports several times more hot spots for the same fire. Counted
as reported, Canada's fire record jumps about fivefold between 2011 and 2012 although nothing changed
on the ground. Pyronac harmonizes the two records into one, on the scale of VIIRS on Suomi NPP, and
shows it as a calendar of burning activity from 2003 to this month for any area the user picks on a
globe, in Canada, India and Brazil. On six years the method never saw, the typical error of a
monthly total falls from about 80% for raw MODIS to about 14% after harmonization (Canada). An
emergency manager can ask "is this October unusual here?" and get an answer that does not depend on
which satellite was flying.

## Link to project demo

**TODO (Sam, Andrew L):** a video of 30 seconds or less, or at most 7 slides, on a public link that
needs no login. Going over either limit makes the project ineligible for global judging. A slide
outline is at the end of this file.

## Link to final project

- Repository: https://github.com/andrewl746/pyronac (public, checked Saturday 12:25).
- Live site: **TODO**, only if the deploy extra is done. Otherwise leave it out.

## Detailed description

### What it does

- **Pick an area.** The app opens on a globe with burned cells marked. The user clicks a preset such
  as the Northwest Territories, Punjab and Haryana or the southern Amazon, types latitude and
  longitude, or draws a box.
- **Read the calendar.** One row per year and one column per month, 2003 to 2026. Colour shows how
  many hot spots, on a log scale, with a legend in real counts. Big fire years such as 2014 and 2023
  stand out. The current month is marked as partial.
- **See the problem and the fix.** A switch flips between "Harmonized" and "Raw". In raw mode the
  years from 2012 on look several times busier than the years before, because of the sensor change.
  In harmonized mode that false jump is gone.
- **Compare a month with its history.** A panel puts any month beside the same calendar month in
  every other year: the median, the usual range, the rank, and a sentence such as "July 2023 was
  1,220% above the usual July here" for the Northwest Territories.
- **Follow the second handoff.** Suomi NPP stopped delivering data on 2 November 2026. From November
  2026 the record continues on NOAA-20, scaled by a ratio measured while both satellites flew. The
  calendar marks the handoff with a line and a label.
- **See the trend, raw against harmonized.** A chart of yearly totals with a fitted trend for each
  record, and a few plain sentences built from the numbers by a fixed template. The raw record
  overstates the rise. For all of Canada, 2003 to 2025, both records rise, the raw one by 129% a
  decade and the harmonized one by 82%. For the southern Amazon box the raw record rises by 48% a
  decade while the harmonized one falls by 35%.
- **See what is unusual on the map.** An "Anomaly" view colours each cell by how unusual the selected
  month is against the same calendar month in other years.
- **Play it as a time-lapse.** A Play button steps through the months on the map.
- **Take the data away.** The hot spots for the area and dates download as a CSV, the calendar as a
  CSV, and the calendar and the comparison chart as PNG images.

**TODO (Sam):** add the fire season shift here if pull request #35 is merged.

### How it works

- **Data.** NASA FIRMS active fire detections for Canada, India and Brazil, 2003 to 14 November
  2026: MODIS from 2003, VIIRS on Suomi NPP from 2012, VIIRS on NOAA-20 from 2018. That is 42.8
  million detections after dropping low-confidence ones and non-vegetation sources.
- **Grid.** Detections are counted per month in cells of 0.1 by 0.1 degree. Every number in the app
  is a sum over whole cells, so the map, the calendar, the comparison and the downloads always agree.
- **Harmonization.** Every month is put on the scale of VIIRS on Suomi NPP. From February 2012 to
  October 2026 the record is Suomi NPP as observed. Before that, a gradient boosting model estimates
  what Suomi NPP would have reported from what MODIS saw (count, fire radiative power, place, season
  and neighbouring cells). Where the model has no estimate, a ratio per 1 degree block and calendar
  month is used. From November 2026 the record is NOAA-20 times a handoff ratio measured over April
  2018 to October 2025, when both VIIRS satellites flew. The ratio is close to 1 (Canada 0.997,
  India 0.987, Brazil 1.011).
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

The build with all three countries reports 77.7% for raw MODIS and 10.6% after harmonization for
monthly totals per country. That is the number the app's method note shows.

**TODO (Andrew L):** `docs/METHOD.md` still gives Canada only. Say which pair is the headline (79.9%
to 13.5% for Canada, or 77.7% to 10.6% for the three countries), make the summary above match, and
add one sentence on what is weakest (for Canada, 2024 is the one year far off, at +14.8%).

### Benefits

- Fire managers and researchers get one consistent record of more than two decades instead of two
  records that cannot be compared.
- "Unusual" is measured against the same place and the same calendar month, on the same scale.
- The record does not break when a satellite stops delivering data. Suomi NPP stopped delivering
  data on 2 November 2026, and the move to NOAA-20 is handled the same way as the move from MODIS
  to VIIRS.
- The method is simple to explain and its error is measured and shown in the app.

### Accessibility

- Two colour ramps for the calendar and charts, both readable with colour vision deficiency
  (inferno and cividis).
- Every value is available as a number: legends with real counts, tooltips on hover (and on
  keyboard focus in the calendar), a table view of the calendar, and a sentence for the comparison.
- Everything works by keyboard, with a visible focus ring. Text contrast is at least 4.5 to 1.

### Tools and languages

Python, DuckDB, pandas, PyArrow, NumPy, SciPy, scikit-learn, FastAPI, uvicorn, pytest, TypeScript,
React, Vite, MapLibre GL JS, Recharts, Tailwind CSS, d3-scale-chromatic, Zustand, TanStack Query.

## Use of AI tools

The form calls this "SI". Source: `docs/AI_USE.md`, which has one row per working session with the
time, the person, the tool, what it produced and how it was checked. On Saturday afternoon it had
rows from all six teammates.

- AI coding assistants wrote most of the code and the first drafts of the documentation, including
  this text, working from a specification the team wrote. The tools were Claude Code (Vlad, Sam,
  Angela, Andrew N, Andrew L, Yuvi) and OpenAI Codex (Yuvi).
- The idea, the choice of method and the decisions between options are the team's.
- Each session's row says how the output was checked: builds, tests, lint and browser runs on the
  fixtures and on the real data.
- No images, video or audio were made with AI. **TODO:** change this line if that stops being true;
  anything of that kind needs a visible watermark.
- Nothing AI-generated contains NASA logos, flags or mission identifiers.

**TODO (everyone):** read your own rows in `docs/AI_USE.md` once more before submitting and correct
this section if a tool is missing.

## NASA data

- FIRMS MODIS Collection 6.1 active fire detections (Terra and Aqua), 1 km.
- FIRMS VIIRS 375 m active fire detections from Suomi NPP.
- FIRMS VIIRS 375 m active fire detections from NOAA-20.

Yearly country files for 2003 to 2025, and FIRMS archive requests by country for 1 January to
14 November 2026. Details and checks are in `docs/DATA_NOTES.md`.

Links:

- NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/
- Yearly country files: https://firms.modaps.eosdis.nasa.gov/data/country/
- Archive download (2026): https://firms.modaps.eosdis.nasa.gov/download/

**TODO (Yuvi):** add the data citations FIRMS asks for.

## Other references

- Challenge: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots
- MapLibre GL JS, the map library.
- Base map imagery: Sentinel-2 cloudless 2024 by EOX IT Services GmbH (contains modified Copernicus
  Sentinel data 2024), https://s2maps.eu, licence CC BY-NC-SA 4.0. Borders and labels: OpenFreeMap,
  © OpenMapTiles, data from OpenStreetMap. **TODO (Vlad):** confirm this is still the base map in
  the final build.
- Python libraries: DuckDB, FastAPI, uvicorn, NumPy, SciPy, pandas, PyArrow, scikit-learn, httpx,
  python-dotenv, pytest.
- JavaScript libraries: React, Vite, TypeScript, Tailwind CSS, Recharts, d3-scale-chromatic (inferno
  and cividis ramps), Zustand, TanStack Query, Oxlint.

This list was compared with `backend/requirements.txt`, `pipeline/requirements.txt` and
`frontend/package.json` on Saturday afternoon. **TODO (Sam):** compare once more before submitting.

## Before pressing submit

- [ ] Every **TODO** above is gone.
- [ ] The numbers match `docs/METHOD.md` and the method note in the app.
- [ ] The demo is 30 seconds or less, or at most 7 slides.
- [ ] Every link opens in a private browser window with no login.
- [ ] Everyone on the team has read the text.
- [ ] "Terms and Conditions" and "Confirm All Work is Original" are ticked, then "Submit for Judging".

## Slide outline for the demo (draft, at most 7 slides)

Text only. The pictures are screenshots of the app on the real data, taken by a person. No
AI-generated images.

1. **Pyronac, the fire almanac.** One line: one consistent fire record, 2003 to this month, for any
   area. Picture: the globe with burned cells.
2. **The problem.** Two instruments, two scales. Canada's raw record jumps about fivefold from 2011
   to 2012 with no change on the ground. Picture: the calendar for the Northwest Territories in Raw
   mode.
3. **The fix.** The same calendar in Harmonized mode, on the scale of VIIRS on Suomi NPP. The false
   jump is gone. Picture: Raw and Harmonized side by side.
4. **Does it work?** Learned on 2012 to 2019, tested on 2020 to 2025: the typical error of a monthly
   total falls from about 80% to about 14% (Canada). Picture: the validation table.
5. **Is this month unusual?** The compare panel: a month against the same month in every other year,
   in one sentence. Picture: July 2023 for the Northwest Territories.
6. **The record carries on.** Suomi NPP stopped delivering data on 2 November 2026. The record
   continues on NOAA-20 with a measured ratio close to 1. Picture: the top rows of the calendar with
   the handoff line. Also the trend: raw overstates the rise.
7. **Use it.** Canada, India and Brazil. CSV and PNG downloads, colour ramps safe for colour vision
   deficiency, keyboard access. NASA FIRMS data, the team, the repository link.

**TODO (Sam, Andrew L):** agree the headline numbers for slide 4, then take the screenshots.
