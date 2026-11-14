# Pyronac, the fire almanac: master spec

NASA Space Apps Challenge 2026, Toronto, 14 to 15 November.
Challenge: [MODIS and VIIRS hot spots](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots).
Team: Andrew L, Vlad, Yuvi, Andrew N, Angela, Sam.

The app is called **Pyronac**, from pyro and almanac. Its tagline is "the fire almanac". Use both together wherever a user first sees the name.

This file is the single source of truth for the project. Every teammate and every AI assistant works from it. It lives in the repo root as `MASTERSPEC.md`.

## Contents

0. Start here
1. The challenge
2. What we are building
3. Stack and architecture
4. Repo layout and who owns what
5. Data contract
6. Harmonization
7. API contract
8. Frontend contract
9. Working rules
10. Task sheets, one per person
11. Timeline and checkpoints
12. How work is checked
13. Extras, in order
14. Submission
15. Glossary
Appendix A. Starter files, copied exactly

---

## 0. Start here

### If you are a teammate

1. Read sections 0 to 4, then your own task sheet in section 10. Skim the rest.
2. Do the "before Saturday 9:00" list at the end of this section.
3. Open your AI assistant in the repo folder and paste the kickoff prompt below with your name in it.

Kickoff prompt:

```
I am <NAME> on the Pyronac team. Read MASTERSPEC.md in the repo root from top to bottom
before doing anything else. Then tell me, in five lines or fewer, what my part is and which
files I own. Then start on step 1 of my task sheet in section 10. Follow the rules in section 0
exactly. Before you tell me a step is done, run its check and show me the output.
```

At the start of every later session, paste: `Re-read MASTERSPEC.md, then continue my task sheet from where git log and the code say I stopped.`

### If you are an AI assistant

You are helping one teammate build one part of a six-person project. Five other people and their assistants are building the other parts at the same time, from this same file. The parts only fit together if everyone copies the shared names exactly. These rules matter more than speed.

1. **This file wins.** If the code and this file disagree, the code is wrong. If you think this file is wrong, say so to your human and stop. Do not quietly do something different.
2. **Never invent a shared name.** Column names, table names, file paths, endpoint paths, query parameters, JSON field names and TypeScript types are all defined here. Copy them character for character. Do not rename, pluralise, re-case or "improve" them.
3. **Stay in your own files.** Section 4 says who owns each path. Only create or edit files your human owns. If you need a change in someone else's file, tell your human what to ask for.
4. **Never change a contract on your own.** Sections 5, 6, 7 and Appendix A are contracts. If one blocks you or looks broken, stop and tell your human to raise it in the team chat. The one exception is in rule 5.
5. **Appendix A files are copied exactly.** If a copied file has a bug that stops it running, make the smallest fix that works, and tell your human to post the fix in the team chat so this file gets corrected. Do not restructure it.
6. **Build only what your task sheet says, in order.** No extra features, no extra libraries, no refactors of working code. Section 2 lists what is out of scope.
7. **Keep it simple.** No Docker, no login, no database server, no ORM, no state machines, no microservices, no new frameworks. The decisions in section 3 are final.
8. **Prove it before you say it is done.** Each step has a check. Run it and show the output. If you could not run it, say so plainly. Never report a check as passing unless you saw it pass.
9. **Small pull requests.** One step per branch where you can. Follow section 9.
10. **No secrets and no data in git.** Keys go in `.env`. Everything under `data/` except `data/fixtures/` is ignored by git and must stay that way.
11. **Record what you generated.** After each working session add a line to `docs/AI_USE.md`. The hackathon rules require this (section 9).
12. **When something is unclear,** pick the simplest reading that matches the examples in this file, write the assumption in the pull request description, and carry on. If two readings would produce different shared names or numbers, stop and ask instead.
13. **You build, people decide.** If you think the approach should change, say why in two or three sentences and let your human take it to the team. Do not redesign.

### Before Saturday 9:00 (everyone)

- Install Git, Python 3.11 or newer, and Node.js 20 or newer. Check with `git --version`, `python --version`, `node --version`.
- Make sure you are registered for Space Apps, on the Toronto local event, and showing on the team's Members tab. A team can have at most six members and everyone must be on the same local event.
- Accept the GitHub invite to the repo and clone it.
- Read this file.
- Yuvi and Andrew L: get a free FIRMS MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key/ and put it in your own `.env` as `FIRMS_MAP_KEY=...`. Never commit it.
- Yuvi: submit the 2026 archive requests described in section 5.1 as soon as you read this. They arrive by email and can take a while.

---

## 1. The challenge

Two families of satellite instruments record fires as "hot spots".

- **MODIS** has flown since 2000 on the Terra and Aqua satellites. Each pixel is about 1 km across.
- **VIIRS** has flown since 2012, first on the Suomi NPP satellite and later on NOAA-20 and NOAA-21. Each pixel is 375 m across, so it sees smaller fires and reports several times more hot spots for the same fire.

If you count MODIS hot spots before 2012 and VIIRS hot spots after, the count jumps in 2012 for no real reason. The challenge is to **harmonize** the two records so that "the sensor of origin no longer matters", and to put the result in a web app for emergency managers.

A new fact makes this timely. **Suomi NPP stopped delivering data on 2 November 2026.** The VIIRS record now continues on NOAA-20. That is a second handoff between satellites, and our method treats it the same way as the first.

### What the challenge asks for

Every one of these must work in the demo. Each has an id used in the rest of this file.

| Id | Feature | Built by |
|---|---|---|
| F1 | One harmonized hot spot record combining MODIS and VIIRS | Yuvi (data), Andrew L (method) |
| F2 | A calendar of burning activity, months by years, from the early 2000s to now | Angela (API), Sam (display) |
| F3 | Pick a region by drawing on a map or typing latitude and longitude, and pick a date range | Vlad |
| F4 | Compare a month with the historical median for that area | Andrew N (API), Sam (display) |
| F5 | Download a CSV of the hot spots found, plus charts | Angela (CSV), Sam (buttons and chart export) |
| F6 | Accessible colour ramps | Sam |

### How it is judged

Local judges in Toronto score every project on five criteria: **impact, creativity, validity, relevance, presentation**. There is no prize per challenge. The global awards we fit best are Best Use of Data and Best Use of Science. "Validity" rewards a method that is scientifically sound and shown to work, so the validation numbers in section 6 matter as much as the visuals.

---

## 2. What we are building

**Pyronac, the fire almanac,** is a web app. The user picks an area anywhere in Canada (then northern India and the Amazon) and sees the fire history of that area as one consistent record from 2003 to this month.

### The user flow, which is also the demo

1. The app opens on a dark globe. Cells where fires have burned glow.
2. The user clicks "Northwest Territories" or draws a box. The map zooms in.
3. A calendar appears: one row per year, one column per month, 2003 to 2026. Colour shows how many hot spots. 2014 and 2023 stand out.
4. The user flips a switch from "Harmonized" to "Raw". In raw mode the years from 2012 on look several times busier than the years before, because of the sensor change. Flip back and the false jump is gone. This is the moment that shows what the project does.
5. A panel compares October 2026 with every other October: the median, the usual range, and a sentence such as "62% above the usual October".
6. A note shows that Suomi NPP ended on 2 November 2026 and that November comes from NOAA-20, scaled the same way.
7. The user downloads the hot spots as a CSV and the calendar as an image.

### Out of scope. Do not build these.

- Forecasting future fires
- Fire perimeters, burned area, smoke, weather or vegetation layers
- User accounts, saved searches, alerts or emails
- Polygon or freehand selection (rectangles only, unless section 13 says otherwise)
- Any country other than Canada, India and Brazil
- Daily or weekly resolution. The record is monthly.
- Mobile-first layouts. It must not break on a laptop screen. That is enough.

---

## 3. Stack and architecture

These choices are final. Do not swap any of them.

| Part | Choice | Notes |
|---|---|---|
| Data pipeline | Python 3.11+, DuckDB | Plain scripts in `pipeline/`. pandas and scikit-learn only for the ML step. |
| Storage | Parquet files on disk | No database server. |
| Backend | FastAPI, DuckDB, uvicorn | Reads the Parquet files. Read-only. |
| Backend tests | pytest with FastAPI's TestClient | Tests run on the fixtures. |
| Frontend | Vite, React, TypeScript | `npm create vite@latest frontend -- --template react-ts` |
| Map | MapLibre GL JS 5 or newer, globe projection | MapLibre's own layers only. No deck.gl, no Leaflet, no Mapbox token. |
| Charts | Hand-written SVG for the calendar, Recharts for line and bar charts | SVG so charts can be downloaded as images. |
| Styling | Tailwind CSS 4 with the Vite plugin, plus the CSS variables in section 8 | |
| Frontend state | Zustand for shared state, TanStack Query 5 for requests | |
| Colour ramps | `d3-scale-chromatic` | |

Use the versions the install commands give you. Do not pin older ones.

```
FIRMS CSV files                pipeline/                    data/processed/ (or data/fixtures/)
(NASA, per country, per year)  download.py   build.py       points/year=YYYY/*.parquet
        │                      harmonize.py  ...            grid_counts.parquet
        └──────────────────────────►│                       grid.parquet
                                    └──────────────────────►harmonization.json
                                                                   │
                                                 backend/ (FastAPI + DuckDB, port 8000)
                                                 /api/meta  /api/calendar  /api/grid
                                                 /api/compare  /api/points.csv  ...
                                                                   │  JSON and CSV
                                                 frontend/ (Vite + React, port 5173)
                                                 map, calendar, compare panel, downloads
```

### Running it locally

```bash
# Backend, from the repo root
python -m venv .venv
# Windows:  .venv\Scripts\activate        macOS and Linux:  source .venv/bin/activate
pip install -r backend/requirements.txt -r pipeline/requirements.txt
cd backend
uvicorn app.main:app --reload --port 8000
# Check: http://localhost:8000/api/health  and the interactive docs at http://localhost:8000/docs

# Frontend, in a second terminal
cd frontend
npm install
npm run dev
# Check: http://localhost:5173
```

The Vite dev server forwards `/api` to `http://localhost:8000`, so frontend code always calls relative paths like `/api/calendar`. Put this in `frontend/vite.config.ts`:

```ts
server: { proxy: { "/api": "http://localhost:8000" } }
```

Two settings exist for the frontend, in `frontend/.env.local`:

- `VITE_USE_MOCKS=1` makes the app use the built-in fake API instead of the backend. Use it until the backend endpoint you need exists.
- `VITE_API_BASE=https://...` is only for a deployed build.

The backend picks its data folder by itself: `data/processed/` if `data/processed/grid.parquet` exists, otherwise `data/fixtures/`. Set `FIRE_DATA_DIR` to force one.

`backend/requirements.txt`:

```
fastapi
uvicorn[standard]
duckdb
numpy
scipy
pytest
httpx
```

`pipeline/requirements.txt`:

```
duckdb
pandas
pyarrow
scikit-learn
httpx
python-dotenv
```

---

## 4. Repo layout and who owns what

```
MASTERSPEC.md            this file
extract_starter.py       writes the Appendix A files (top of Appendix A)
CLAUDE.md                one line: "Read MASTERSPEC.md before doing anything. Follow section 0."
README.md                what the project is, how to run it, AI use note
.gitignore               Appendix A
.env.example             FIRMS_MAP_KEY=
docs/
  AI_USE.md              everyone appends
  DATA_NOTES.md          Yuvi
  METHOD.md              Andrew L
  SUBMISSION.md          Sam
data/
  raw/                   downloaded FIRMS files          (ignored by git)
  interim/               pipeline workspace              (ignored by git)
  processed/             real tables                     (ignored by git)
  fixtures/              small fake data set             (committed)
pipeline/
  requirements.txt
  config.py              Appendix A
  make_fixtures.py       Appendix A
  build.py               Appendix A
  harmonize.py           Appendix A to start, then Andrew L
  download.py            Yuvi
  validate.py            Andrew L
  ml_model.py            Andrew L
backend/
  requirements.txt
  pytest.ini             Appendix A
  app/
    __init__.py          empty
    main.py              Appendix A
    config.py            Appendix A
    db.py                Appendix A
    deps.py              Appendix A
    routers/
      __init__.py        empty
      meta.py            Angela
      calendar.py        Angela
      grid.py            Angela
      export.py          Angela
      compare.py         Andrew N
      trend.py           Andrew N
      anomaly.py         Andrew N
    analysis/
      __init__.py        empty
      stats.py           Andrew N
  tests/
    conftest.py          Appendix A
    test_meta.py, test_calendar.py, test_grid.py, test_export.py      Angela
    test_stats.py, test_compare.py, test_trend.py, test_anomaly.py    Andrew N
frontend/
  vite.config.ts, index.html, package.json                            Vlad
  src/
    main.tsx, App.tsx                                                 Vlad
    api/types.ts, api/mock.ts, api/client.ts                          Appendix A
    api/hooks.ts                                                      Vlad
    state/store.ts                                                    Appendix A
    theme.css                                                         Sam
    lib/colors.ts, lib/format.ts, lib/download.ts                     Sam
    lib/geo.ts                                                        Vlad
    components/map/                                                   Vlad
    components/region/                                                Vlad
    components/Sidebar.tsx                                            Sam (Vlad adds an empty one in the scaffold)
    components/calendar/                                              Sam
    components/controls/                                              Sam
    components/compare/                                               Sam
    components/downloads/                                             Sam
    components/trend/, components/summary/                            Yuvi (after the data is done)
```

| Person | Owns |
|---|---|
| Yuvi | `pipeline/` except `harmonize.py`, `validate.py`, `ml_model.py`. `data/fixtures/`. `docs/DATA_NOTES.md`. Root files (`README.md`, `.gitignore`, `.env.example`, `CLAUDE.md`). Later `frontend/src/components/trend/` and `summary/`. |
| Andrew L | `pipeline/harmonize.py`, `pipeline/validate.py`, `pipeline/ml_model.py`, `docs/METHOD.md`. Runs the checkpoint checks in section 12. |
| Angela | `backend/` except the files listed for Andrew N. |
| Andrew N | `backend/app/routers/compare.py`, `trend.py`, `anomaly.py`, `backend/app/analysis/`, and their tests. |
| Vlad | `frontend/` scaffold and config, `src/main.tsx`, `src/App.tsx`, `src/api/`, `src/state/`, `src/lib/geo.ts`, `src/components/map/`, `src/components/region/`. |
| Sam | `frontend/src/theme.css`, `src/lib/colors.ts`, `format.ts`, `download.ts`, `src/components/Sidebar.tsx`, `calendar/`, `controls/`, `compare/`, `downloads/`. `docs/SUBMISSION.md`, slides and video. |

Files marked "Appendix A" are shared. Whoever creates them copies them exactly, and after that nobody edits them without agreement in the team chat.

---

## 5. Data contract

### 5.1 Where the data comes from

All data is from NASA FIRMS (Fire Information for Resource Management System).

**Years 2003 to 2025: yearly country files, direct download, no login.**

```
https://firms.modaps.eosdis.nasa.gov/data/country/<source>/<year>/<source>_<year>_<Country>.csv
```

| `<source>` | Instrument | Yearly files exist for | We use |
|---|---|---|---|
| `modis` | MODIS on Terra and Aqua | 2000 to 2025 | 2003 to 2025 |
| `viirs-snpp` | VIIRS on Suomi NPP | 2012 to 2025 | all |
| `viirs-jpss1` | VIIRS on NOAA-20 | 2018 to 2025 | all |

`<Country>` is `Canada`, `India` or `Brazil`. Example:
`https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2023/viirs-snpp_2023_Canada.csv`

Approximate download sizes: Canada 1.0 GB (MODIS 0.13, Suomi NPP 0.53, NOAA-20 0.38), India 1.2 GB, Brazil 3.2 GB. Canada comes first. The biggest single file is Suomi NPP Canada 2023 at 141 MB.

Save each file as `data/raw/<source>/<source>_<year>_<Country>.csv`, keeping the original name.

**Year 2026: archive request, delivered by email.** The yearly files stop at 2025.

1. Go to https://firms.modaps.eosdis.nasa.gov/download/ and sign in with an Earthdata login or an email code.
2. Create a request per country: area = the country, date range = 2026-01-01 to today, format = CSV, sources = MODIS Collection 6.1, VIIRS S-NPP 375 m, VIIRS NOAA-20 375 m.
3. The email links to a zip. Inside are files named like `fire_archive_M-C61_<id>.csv` and `fire_nrt_M-C61_<id>.csv`. `M` is MODIS, `SV` is Suomi NPP, `J1V` is NOAA-20. "archive" is the quality-checked data, "nrt" is the recent near-real-time data.
4. Copy each file into the matching source folder, renamed so it ends in `_<Country>.csv`, for example `data/raw/modis/modis_2026-archive_Canada.csv` and `data/raw/modis/modis_2026-nrt_Canada.csv`. Do not merge the two files. `build.py` reads every CSV in the folder.

The archive covers everything except the most recent 7 days. That is fine. The app shows the date the data runs to.

If the form has no country option, request the country's bounding box instead and tell the team, because detections from neighbouring countries then need clipping out with a country outline before the 2026 data is used.

### 5.2 Raw columns

MODIS files:

```
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
56.0406,-121.3964,311,1.2,1.1,2003-01-01,0606,Terra,MODIS,81,6.2,270.3,21.5,N,0
```

VIIRS files (both satellites):

```
latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type
50.73722,-98.21366,326.24,0.56,0.69,2020-01-01,0726,N,VIIRS,n,2,263.48,2.95,N,0
```

Things that differ between files and trip people up:

| Column | Yearly and archive files | Near-real-time files |
|---|---|---|
| `satellite` (MODIS) | `Terra`, `Aqua` | `T`, `A` |
| `satellite` (VIIRS) | `N` for Suomi NPP, `N20` for NOAA-20 | same |
| `confidence` (MODIS) | a number, 0 to 100 | same |
| `confidence` (VIIRS) | `l`, `n`, `h` | `low`, `nominal`, `high` |
| `type` | 0 vegetation fire, 1 volcano, 2 other static land source, 3 offshore | column is missing |
| `acq_time` | four digits, UTC, such as `0606`. Read it as text or the leading zero is lost. | same |

`acq_date` is a UTC date. `frp` is fire radiative power in megawatts.

### 5.3 Cleaning rules

Applied the same way to every file. The SQL in `pipeline/build.py` (Appendix A) is the exact definition.

1. Drop low-confidence detections: MODIS `confidence` below 30, VIIRS `confidence` starting with `l`.
2. Keep only presumed vegetation fires: `type` is 0 or missing.
3. Drop anything before 2003-01-01. Before then only one MODIS satellite was flying for most of the time, which would add a third inconsistency.
4. The satellite comes from the folder the file is in, not from the `satellite` column, except for telling Terra from Aqua.
5. Confidence is normalised to `nominal` or `high`. MODIS 30 to 79 is `nominal`, 80 and up is `high`.

### 5.4 Grid cells

The world is cut into cells of 0.1 degree by 0.1 degree. A cell is identified by two whole numbers.

```
cell_x = floor(longitude * 10)        cell_y = floor(latitude * 10)
```

A cell covers longitude `cell_x / 10` up to but not including `(cell_x + 1) / 10`, and latitude `cell_y / 10` up to but not including `(cell_y + 1) / 10`.

Worked example: a detection at latitude 62.4567, longitude -114.3712 is in `cell_y = 624`, `cell_x = -1144`. Note that the floor of -1143.712 is -1144, not -1143. Rounding towards zero is the most common mistake here.

Always round before flooring, to dodge floating point noise: in SQL `CAST(floor(round(longitude * 10, 6)) AS INTEGER)`, in Python `math.floor(round(longitude * 10, 6))`.

**Every area box is snapped outward to whole cells** before anything is counted (see `backend/app/deps.py`). All filtering is done on `cell_x` and `cell_y`, never on raw latitude and longitude. This is what makes every number in the app agree with every other number.

### 5.5 Eras

Months are compared as one number, `ym = year * 100 + month`. January 2012 is 201201.

| Era id | Months | The record in this era is |
|---|---|---|
| `modis` | 200301 to 201201 | MODIS counts scaled up to the VIIRS scale |
| `snpp` | 201202 to 202610 | VIIRS on Suomi NPP, exactly as observed |
| `noaa20` | 202611 onwards | VIIRS on NOAA-20, times a handoff ratio close to 1 |

Suomi NPP data starts on 20 January 2012 and ends on 2 November 2026. Those two partial months are deliberately left out of the `snpp` era. The constants are `MODIS_ERA_END_YM = 201201` and `SNPP_ERA_END_YM = 202610` in both `pipeline/config.py` and `backend/app/config.py`.

### 5.6 Tables

All tables are written by `pipeline/build.py` into `data/processed/` (real) or `data/fixtures/` (fake).

**`points/year=YYYY/*.parquet`** One row per detection that the record uses: all MODIS, Suomi NPP for months 201202 to 202610, NOAA-20 from 202611.

| Column | Type | Meaning |
|---|---|---|
| `latitude`, `longitude` | DOUBLE | Centre of the fire pixel, WGS84 degrees |
| `acq_date` | DATE | UTC date |
| `acq_time` | VARCHAR | UTC time as four digits, `HHMM` |
| `sensor` | VARCHAR | `MODIS` or `VIIRS` |
| `satellite` | VARCHAR | `Terra`, `Aqua`, `SNPP` or `NOAA20` |
| `confidence` | VARCHAR | `nominal` or `high` |
| `frp` | DOUBLE | Fire radiative power, MW |
| `daynight` | VARCHAR | `D` or `N` |
| `country` | VARCHAR | `canada`, `india` or `brazil` |
| `cell_x`, `cell_y` | INTEGER | Grid cell, section 5.4 |
| `year`, `month` | INTEGER | From `acq_date`. `year` is stored in the folder name. |

**`grid_counts.parquet`** One row per cell and month in which any satellite saw at least one detection. This is what each satellite saw, before any harmonization. It includes NOAA-20 from 2018 and the partial Suomi NPP months, because the method needs them.

| Column | Type | Meaning |
|---|---|---|
| `cell_x`, `cell_y`, `year`, `month` | INTEGER | The key. No two rows share it. |
| `country` | VARCHAR | |
| `modis_count` | INTEGER | MODIS detections, 0 if none |
| `snpp_count` | INTEGER | Suomi NPP detections, 0 if none or not flying |
| `noaa20_count` | INTEGER | NOAA-20 detections, 0 if none or not flying |
| `modis_frp_sum`, `snpp_frp_sum`, `noaa20_frp_sum` | DOUBLE | Sum of `frp`. Sums add up across cells. Means do not. |

**`grid.parquet`** Everything in `grid_counts` plus one column. This is the table the backend reads.

| Column | Type | Meaning |
|---|---|---|
| `harmonized_count` | DOUBLE | Hot spots on the Suomi NPP VIIRS scale. Never null, never negative. Section 6. |

A month with no row for a cell means zero detections there.

**`harmonization.json`** How `harmonized_count` was made. The backend passes it through in `/api/meta`.

```json
{
  "method": "v0",
  "generated_at": "2026-11-14T15:02:11Z",
  "data_through": "2026-11-06",
  "reference": "VIIRS S-NPP 375 m",
  "handoff_ratio_noaa20": 1.0,
  "train_years": null,
  "test_years": null,
  "validation": null,
  "notes": "Placeholder. One VIIRS to MODIS ratio per country: canada 4.61"
}
```

`method` is `v0`, `ratio` or `ml`. `data_through` is the latest `acq_date` in the data. Once the real method is in, `train_years` and `test_years` are pairs such as `[2012, 2019]`, and `validation` is `{"metric": "...", "raw_error": 0.74, "harmonized_error": 0.12}`.

### 5.7 Fixtures

`data/fixtures/` is a small fake data set in exactly the same shape as the real one, so nobody waits for the real download.

- `python pipeline/make_fixtures.py` writes fake FIRMS-style CSV files to `data/fixtures/raw/`. It always writes the same files.
- `python pipeline/build.py --fixtures` runs the real pipeline on them and writes `data/fixtures/points/`, `grid_counts.parquet`, `grid.parquet` and `harmonization.json`.

Everything fake sits inside one box near Yellowknife: west -116, south 61, east -114, north 63. The fake data runs from 2003 to 6 November 2026, has big fire years in 2004, 2014, 2017 and 2023, and has VIIRS seeing about 4.5 times what MODIS sees. It includes low-confidence rows, static-source rows and near-real-time style rows on purpose, so the cleaning rules get exercised.

The fixtures are committed to git. Backend tests always run on them.

---

## 6. Harmonization

### What `harmonized_count` means

`harmonized_count` answers: "how many hot spots would VIIRS on Suomi NPP have reported for this cell in this month?"

| Era | `harmonized_count` |
|---|---|
| `modis` | MODIS count converted to the VIIRS scale |
| `snpp` | `snpp_count`, unchanged |
| `noaa20` | `noaa20_count` times the handoff ratio |

Because it is defined per cell and per month, the harmonized count for any area and any period is simply the sum. Every endpoint relies on that.

### The interface

`pipeline/harmonize.py` has one function that the rest of the pipeline calls:

```python
def run(con, out_dir, data_through): ...
```

- It reads the DuckDB table `grid_counts` from the connection `con`.
- It creates the DuckDB table `grid`: every column of `grid_counts` plus `harmonized_count`.
- It writes `harmonization.json` into `out_dir`.
- In the `snpp` era `harmonized_count` must equal `snpp_count` exactly.

Nothing else about it may be assumed by other code.

### Versions

- **v0, in Appendix A.** One VIIRS to MODIS ratio per country, handoff ratio 1.0. It exists so everyone has numbers on day one. It is not the final method.
- **ratio.** For each 1 degree block and each calendar month, the ratio of Suomi NPP to MODIS detections over the overlap years. Where a block has too few detections, fall back to the whole country for that calendar month, then to the whole country. The NOAA-20 handoff ratio is learned the same way from 2018 to 2025, when both VIIRS satellites flew.
- **ml.** A gradient boosting model that predicts the VIIRS count of a cell and month from what MODIS saw. It replaces the ratio only if it beats it on the held-out years.

### Validation, which is what we show the judges

Learn the conversion on 2012 to 2019. Apply it to MODIS for 2020 to 2025, years the method never saw, and compare with what Suomi NPP really reported. Report the typical error of monthly totals before and after harmonization. Those two numbers go in `harmonization.json`, in `docs/METHOD.md`, in the app's method note and in the submission.

---

## 7. API contract

### Rules for every endpoint

- All endpoints are `GET` and live under `/api`.
- **The area box.** Endpoints that take an area take four query parameters: `west`, `south`, `east`, `north`, in degrees. Use the shared `bbox_params` dependency from `backend/app/deps.py`. It checks them and snaps the box outward to whole cells.
- Every response for an area includes `"bbox"`, the snapped box. All counts are for the snapped box.
- Filter on `cell_x BETWEEN x0 AND x1 AND cell_y BETWEEN y0 AND y1`. Never filter on `latitude` or `longitude`.
- `harmonized` values are decimals rounded to 1 place. `raw`, `modis` and `viirs` are whole numbers.
- Months are 1 to 12. Month strings are `"YYYY-MM"`. Date strings are `"YYYY-MM-DD"`. Everything is UTC.
- **Errors.** A bad value that the endpoint checks itself returns status 400 with `{"detail": "a sentence a user can read"}`. A missing or wrongly typed parameter returns FastAPI's own 422. Do not invent another error shape.
- Use `db.query(sql, params)` with `?` placeholders. Never put a request value into SQL text.
- Field names in JSON are exactly the ones in `frontend/src/api/types.ts` (Appendix A). That file is the definition of every response.
- The numbers in the examples below are made up. The field names and shapes are exact.

Three values come up repeatedly. Compute them the same way everywhere:

- `data_through`: the `data_through` date in `harmonization.json`.
- `last_month`: the month `data_through` falls in.
- A month is **complete** if it is before `last_month`, or it is `last_month` and `data_through` is the last day of that month. `last_complete_month` is the latest complete month.

### `GET /api/health`

Returns `{"status": "ok"}`. Already in `main.py`.

### `GET /api/meta`  (Angela)

No parameters. Returns `MetaResponse`.

```json
{
  "app": "Pyronac",
  "data_source": "fixtures",
  "first_month": "2003-01",
  "last_month": "2026-11",
  "last_complete_month": "2026-10",
  "data_through": "2026-11-06",
  "countries": ["canada"],
  "presets": [
    {"id": "fixture", "name": "Test box near Yellowknife", "bbox": {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0}},
    {"id": "nwt", "name": "Northwest Territories, Canada", "bbox": {"west": -136.5, "south": 60.0, "east": -102.0, "north": 70.0}}
  ],
  "eras": [
    {"id": "modis", "label": "MODIS, scaled to match VIIRS", "from": "2003-01", "to": "2012-01"},
    {"id": "snpp", "label": "VIIRS on Suomi NPP, as observed", "from": "2012-02", "to": "2026-10"},
    {"id": "noaa20", "label": "VIIRS on NOAA-20, scaled to match Suomi NPP", "from": "2026-11", "to": null}
  ],
  "harmonization": { "...": "the whole of harmonization.json" }
}
```

- `data_source` comes from `config.data_source()`.
- `countries` is the distinct `country` values in `grid`, sorted.
- `presets` is `config.PRESETS` limited to countries that are loaded, with `config.FIXTURE_PRESET` first when `data_source` is `fixtures`. Return only `id`, `name` and `bbox` for each.
- `eras` is `config.ERAS`. `harmonization` is `db.harmonization()`.

### `GET /api/calendar`  (Angela)  F2

Parameters: the box, `start_year` (default 2003, minimum 2003), `end_year` (default: the year of `last_month`). 400 if `start_year` is greater than `end_year`. Returns `CalendarResponse`.

```json
{
  "bbox": {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0},
  "start_year": 2003,
  "end_year": 2026,
  "months": [
    {"year": 2003, "month": 1, "harmonized": 0.0, "raw": 0, "modis": 0, "viirs": null, "era": "modis", "complete": true},
    {"year": 2003, "month": 5, "harmonized": 55.3, "raw": 12, "modis": 12, "viirs": null, "era": "modis", "complete": true},
    {"year": 2023, "month": 7, "harmonized": 1042.0, "raw": 1042, "modis": 231, "viirs": 1042, "era": "snpp", "complete": true},
    {"year": 2026, "month": 11, "harmonized": 24.0, "raw": 24, "modis": 6, "viirs": 24, "era": "noaa20", "complete": false}
  ],
  "max_harmonized": 1042.0,
  "max_raw": 1042
}
```

- `months` has one entry for **every** month from January of `start_year` to December of `end_year`, stopping at `last_month`, in order. Months with no detections are still there, with zeros. For 2003 to 2026 with data through November 2026 that is 287 entries.
- `harmonized` is the sum of `harmonized_count`. `raw` is the sum of `raw_count`. `modis` is the sum of `modis_count`. `viirs` is the sum of `viirs_count`.
- `viirs` is `null` for every month in the `modis` era, and a number (0 when empty) in the later eras.
- `era` comes from `config.era_of(year, month)`.
- `complete` is false only for `last_month` when it is not complete.
- `max_harmonized` and `max_raw` are the largest values in `months`, 0 when there are none.

To get the empty months, build the list of months in Python and fill in the sums from one grouped query. That is simpler and safer than doing it in SQL.

### `GET /api/calendar.csv`  (Angela)  F5

Same parameters as `/api/calendar`. Returns `text/csv` with the header row `year,month,harmonized,raw,modis,viirs,era,complete`, one line per month, `viirs` left empty where it is null. Header `Content-Disposition: attachment; filename="fire_calendar_<start_year>_<end_year>.csv"`.

### `GET /api/grid`  (Angela)  feeds the map

Parameters: the box, `start` and `end` as `"YYYY-MM"` (both included), optional `step` (1, 5 or 10). 400 if `start` is after `end`, if either is not a valid month, or if `step` is anything else. Returns `GridResponse`.

```json
{
  "bbox": {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0},
  "start": "2023-07",
  "end": "2023-07",
  "step": 1,
  "cells": [[-1152, 617, 38.0], [-1151, 617, 12.0]],
  "max": 38.0
}
```

- `step` is how many 0.1 degree cells are merged along each side. If it is not given: 1 when the snapped box is at most 15 degrees wide, 5 when at most 60, otherwise 10.
- Each entry of `cells` is `[x, y, harmonized]`, where `x = floor(cell_x / step)`, `y = floor(cell_y / step)` and `harmonized` is the sum of `harmonized_count` over the period, rounded to 1 place. In SQL write `CAST(floor(cell_x / CAST(? AS DOUBLE)) AS INTEGER)` so negative numbers floor correctly.
- A merged cell covers longitude `x * step / 10` to `(x + 1) * step / 10` and latitude `y * step / 10` to `(y + 1) * step / 10`.
- Only cells with `harmonized` above 0 are returned. `max` is the largest value, 0 when empty.

### `GET /api/points/count` and `GET /api/points.csv`  (Angela)  F5

Parameters for both: the box, `start` and `end` as `"YYYY-MM-DD"` (both included), `sensor` = `all` (default), `modis` or `viirs`. 400 if `start` is after `end` or `sensor` is anything else.

Rows are selected from `points` by cell range, by `acq_date BETWEEN start AND end`, by `year BETWEEN year(start) AND year(end)` (this lets DuckDB skip whole folders), and by `sensor` unless it is `all`.

- `/api/points/count` returns `{"count": 12431}`.
- `/api/points.csv` returns `text/csv` with header row `latitude,longitude,acq_date,acq_time,sensor,satellite,confidence,frp,daynight`, sorted by `acq_date`, `acq_time`, `latitude`, `longitude`. Header `Content-Disposition: attachment; filename="hotspots_<start>_<end>.csv"`. Stream it with `db.stream()` and FastAPI's `StreamingResponse` so a large export does not sit in memory.
- If the count is above `config.MAX_CSV_ROWS` (1,000,000), `/api/points.csv` returns 400 with `{"detail": "Too many hot spots (N). Choose a smaller area or a shorter date range."}`.

These are raw detections. The CSV is what the satellites reported, not harmonized values. For one month and one box, the number of `modis` rows equals `modis` in `/api/calendar`, and the number of `viirs` rows equals `viirs` (or 0 where `viirs` is null).

### `GET /api/compare`  (Andrew N)  F4

Parameters: the box, optional `year` and `month` (default: `last_complete_month`. Give both or neither, otherwise 400), `baseline_start` (default 2003), `baseline_end` (default: the year of `last_complete_month`). Returns `CompareResponse`.

```json
{
  "bbox": {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0},
  "target": {"year": 2026, "month": 10, "harmonized": 61.0, "complete": true, "days_covered": 31},
  "baseline": {"start_year": 2003, "end_year": 2026, "n_years": 23, "median": 38.0, "p25": 27.5, "p75": 49.0, "min": 9.0, "max": 160.0},
  "difference": {"absolute": 23.0, "percent": 60.5, "rank": 4, "of": 24, "percentile": 87.0, "label": "above normal"},
  "history": [{"year": 2003, "harmonized": 41.2}, {"year": 2004, "harmonized": 83.9}]
}
```

- The **target** is the harmonized total for the box in that month. `complete` follows the rule above. `days_covered` is the number of days in the month when it is complete, otherwise the day of the month of `data_through`.
- The **baseline years** are every year from `baseline_start` to `baseline_end` except the target year, and only years in which that calendar month is complete. 400 if that leaves no years.
- `history` has one entry per baseline year, in order, with zeros for years with no detections.
- `median`, `p25`, `p75`, `min`, `max` are over `history`. Use `numpy.percentile` with its default (linear) method.
- `absolute` = target minus median. `percent` = `absolute / median * 100`, or `null` when the median is 0. Both rounded to 1 place.
- `rank` = 1 plus the number of baseline years strictly above the target. `of` = `n_years + 1`.
- `percentile` = 100 times the share of baseline years strictly below the target, rounded to 1 place.
- `label` from `percentile`: 90 or more "well above normal", 75 or more "above normal", above 25 "near normal", above 10 "below normal", otherwise "well below normal". One exception: when the target equals the median, the label is "near normal" whatever the percentile. Without it, a month with no hot spots where none is usual would read as "well below normal".

When the target month is not complete, return the numbers as they are with `complete: false`. Do not scale them up. The frontend labels it as a partial month.

### `GET /api/trend`  (Andrew N)  extra

Parameters: the box, `start_year` (default 2003), `end_year` (default: the latest year whose December is complete). 400 if fewer than 3 years. Returns `TrendResponse`.

- `years`: for each year the harmonized total, the raw total, and `season_center`, the average month number weighted by harmonized count (`sum(month * harmonized) / sum(harmonized)`, `null` when the year has no fire).
- `harmonized_trend` and `raw_trend`: a straight line fitted to yearly totals against year with `scipy.stats.linregress`. `slope_per_year` is the slope. `percent_per_decade` is `slope * 10 / mean * 100`, `null` when the mean is 0. `direction` is "increasing" or "decreasing" when `p_value` is below 0.05, otherwise "no clear trend".
- `season_shift`: the same fit on `season_center` against year, reported as `days_per_decade = slope * 10 * 30.44`. `null` when fewer than 5 years have a `season_center`.

The point of returning both trends: the raw one shows a steep rise that is mostly the sensor change, and the harmonized one shows what is really there.

### `GET /api/anomaly`  (Andrew N)  extra

Parameters: the box, `year`, `month`, optional `step` (same rule as `/api/grid`). Returns `AnomalyResponse`: for each merged cell `[x, y, harmonized, median, percentile]`, where the median and percentile compare the cell's value that month with the same calendar month in every other complete year from 2003, computed as in `/api/compare`. Only cells where the value or the median is above 0.

---

## 8. Frontend contract

### Shared pieces

- `src/api/types.ts`, `src/api/mock.ts`, `src/api/client.ts` and `src/state/store.ts` are in Appendix A. Copy them exactly.
- All requests go through `api` in `client.ts`. No component calls `fetch` itself.
- `src/api/hooks.ts` (Vlad) wraps each `api` function in a TanStack Query hook: `useMeta()`, `useCalendar(bbox, startYear, endYear)`, `useCompare(...)`, `useGrid(...)`, `useTrend(...)`, `useAnomaly(...)`, `usePointsCount(...)`. The query key is the function name followed by its arguments. A hook is disabled while `bbox` is null, except `useMeta` and the world view of `useGrid`.
- Shared state lives in `useStore`: `bbox`, `startYear`, `endYear`, `mode`, `selected`, `ramp`. Anything else is local state inside a component.
- The box in the store is always snapped: `snapBbox` in `src/lib/geo.ts` uses the same floor and ceiling rule as `deps.py`, and everything calls it before `setBbox`.

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Pyronac      data through 6 Nov 2026        [ Harmonized | Raw ]  [ramp]│
├──────────────────────────────────────────────┬───────────────────────────────┤
│                                              │ Region: presets, lat and lon  │
│  MapView                                     │ Years: from, to               │
│  globe, fire cells, the selected box,        │ Calendar                      │
│  "Draw area" button, legend                  │ Compare panel                 │
│                                              │ Trend and summary (extra)     │
│                                              │ Downloads, method note        │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

`App.tsx` renders the header, `<MapView />` on the left and `<Sidebar />` on the right at about 440 px wide, scrolling on its own. `Sidebar.tsx` decides the order of the panels inside it.

### Theme

Dark only. Put these in `src/theme.css` and use them everywhere instead of hard-coded colours.

```css
:root {
  --bg: #0b0d10;
  --panel: #14181d;
  --panel-2: #1b2027;
  --border: #2a313a;
  --text: #e8eaed;
  --text-dim: #9aa4b1;
  --accent: #ff8a3d;
  --focus: #7cc4ff;
  --zero-cell: #1e242c;
}
```

Use the system font stack. Numbers use `font-variant-numeric: tabular-nums`.

### Colour  (Sam, `src/lib/colors.ts`)  F6

```ts
export function scaleValue(value: number, max: number): number   // 0 for value <= 0, else log1p(value) / log1p(max), within 0..1
export function rampColor(t: number, ramp: Ramp): string          // t in 0..1 -> a CSS colour
export function rampStops(ramp: Ramp, n: number): string[]        // n evenly spaced colours, for legends and map layers
```

- `Ramp` is the type exported from `src/state/store.ts`: `"fire"` or `"cividis"`.
- Two ramps, both readable by people with colour vision deficiency: `"fire"` is `interpolateInferno` and `"cividis"` is `interpolateCividis`, both from `d3-scale-chromatic`.
- Counts are very uneven, so colour follows `scaleValue` (a log scale), not the raw count.
- The darkest part of both ramps vanishes on a dark page. Map `t` onto the 0.15 to 1.0 part of the ramp, and draw exactly zero as `--zero-cell`.
- Every coloured thing has a legend with numbers on it, and the exact number is available on hover and on keyboard focus. Colour is never the only way to read a value.

### Map  (Vlad, `src/components/map/`)  F3

- MapLibre GL JS. Style URL `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` (free, no key). Backup: `https://tiles.openfreemap.org/styles/dark`. Keep the attribution control.
- Globe: after the style loads, `map.setProjection({ type: "globe" })`. Start centred on longitude -100, latitude 55, zoom 1.8.
- **Fire cells.** One GeoJSON source and one `fill` layer. Build a square polygon for each entry of `GridResponse.cells` using its `step`. Put `t = scaleValue(value, max)` on each feature and colour with an `interpolate` expression over `rampStops`. Fill opacity about 0.75.
  - No box selected: request the whole world (`west -180, south -90, east 180, north 90`) with `step` 10, for the full year range.
  - Box selected: request that box and let the backend choose `step`.
  - Period: the month in `selected` if there is one, otherwise January of `startYear` to December of `endYear`.
- **Selected box.** Drawn as an outline in `--accent`. When the box changes, `map.fitBounds` to it with padding.
- **Draw area.** A button turns on draw mode: panning is off, the cursor is a crosshair, press, drag and release makes a rectangle, then draw mode turns off and the snapped box goes to `setBbox`. Escape cancels.
- **Legend.** Bottom left, built from `rampStops`, labelled with real counts.
- The map never calls the backend except through the hooks.

### Region panel  (Vlad, `src/components/region/`)  F3

- Preset buttons from `useMeta().presets`.
- Four number inputs: north, south, west, east, with an Apply button. Show a plain message when south is not below north or west is not below east.
- A Clear button sets the box to null.
- The inputs always show the current box, including one drawn on the map.

### Calendar  (Sam, `src/components/calendar/`)  F2

- An SVG. One row per year with the newest at the top, one column per month, January to December, with labels. A last column shows each year's total as a number.
- Cell colour is `rampColor(scaleValue(value, max), ramp)`, where `value` is `harmonized` or `raw` depending on `mode`, and `max` is `max_harmonized` or `max_raw`. Zero is `--zero-cell`.
- A month with `complete: false` gets a dashed outline and the word "partial" in its tooltip.
- A thin line marks each change of era (after January 2012 and after October 2026), with a short label.
- Hover and keyboard focus show: month and year, the harmonized count, the MODIS count, the VIIRS count when there is one, and the era label.
- Each cell is focusable and has an `aria-label` such as "July 2023, 1,042 hot spots".
- Clicking a cell calls `setSelected`. Clicking it again clears it.
- A "Table" toggle shows the same numbers as an HTML table.
- With no box selected, show one line: "Pick an area on the map to see its fire calendar."

### Controls  (Sam, `src/components/controls/`)

- Harmonized or Raw switch, bound to `mode`. A short line under it explains what raw means.
- Year range: two selects bound to `startYear` and `endYear`, limited by `first_month` and `last_month` from `useMeta()`.
- Ramp switch, bound to `ramp`.

### Compare panel  (Sam, `src/components/compare/`)  F4

- Compares the month in `selected`, or the latest complete month when nothing is selected.
- Headline: the percent difference and the label, in words, for example "October 2026 was 61% above the usual October here". When `percent` is null say "No fires are usual here in October".
- Chart: one bar per baseline year for that calendar month, a line at the median, a shaded band from `p25` to `p75`, and the target year in `--accent`.
- When `target.complete` is false, say so clearly: "November 2026 so far, 6 days of data".

### Downloads  (Sam, `src/components/downloads/`)  F5

- A date range (two date inputs) defaulting to the selected month, or the latest complete month.
- "Hot spots (CSV)" links to `api.pointsCsvUrl(...)`. Show the row count from `usePointsCount` beside it. Above 1,000,000 rows, disable it and say to narrow the area or dates.
- "Calendar (CSV)" links to `api.calendarCsvUrl(...)`.
- "Calendar (PNG)" and "Comparison chart (PNG)" use `downloadSvgAsPng(svgElement, filename)` from `src/lib/download.ts`, which serialises the SVG, draws it on a canvas at twice the size with the `--panel` background, and saves it.
- A method note under the buttons, built from `useMeta().harmonization`: the method, the validation numbers when present, and the date the data runs to.

### Accessibility  F6

- Every control is reachable and usable by keyboard, with a visible focus ring in `--focus`.
- Text contrast is at least 4.5 to 1. The variables above already meet that.
- Charts have a text alternative: the table toggle for the calendar, the headline sentence for the comparison.
- Nothing depends on colour alone.
- Respect `prefers-reduced-motion`: no map fly animation when it is set.

---

## 9. Working rules

### Git

- `main` always runs. If you break it, fixing it comes before anything else.
- Work on a branch named `<yourname>/<what>`, for example `angela/calendar-endpoint`.
- Before opening a pull request: pull `main` into your branch, run your checks, and list in the description what you checked and any assumption you made.
- **A pull request that only touches files you own:** merge it yourself as soon as your checks pass. Do not wait.
- **A pull request that touches a shared file** (this file, anything from Appendix A, the fixtures, or someone else's path): post it in the team chat and wait for the owner or one other person to agree.
- Never force-push to `main`. Never rewrite someone else's branch.
- Commit small and often. A commit message says what changed in plain words.
- In the first hour only, the three scaffolds (root and pipeline, backend, frontend) go straight to `main`, because nothing exists yet and they touch different folders.

### Secrets and data

- Keys live in `.env`, which git ignores. `.env.example` lists the names with empty values.
- Nothing under `data/` is committed except `data/fixtures/`.
- Do not paste a key into a chat with an AI assistant, a commit, a screenshot or the team chat.

### Hackathon rules that change how we work

- **AI use must be shown.** The rules allow AI tools and require that we "clearly indicate where and how" they were used. Code and data need it in descriptive text and metadata. Images and video made with AI need a visible watermark. So:
  - After each working session, add a row to `docs/AI_USE.md`: time, your name, the tool, what it produced, and how a person checked it.
  - Leave your AI tool's own attribution line on commits. That is the metadata.
  - `README.md` has an "AI use" section that points to `docs/AI_USE.md`.
  - Do not generate images or video with AI. If the team decides to, they carry a visible watermark.
  - Nothing AI-generated may contain NASA logos, flags or mission identifiers.
- **The idea is the team's.** AI tools are for building, not for deciding how to solve the challenge. Every teammate should be able to explain the method in section 6 in their own words.
- **We must use NASA data**, and say exactly which. We use FIRMS MODIS Collection 6.1 and VIIRS 375 m active fire data.
- **The demo is a video of 30 seconds or less, or at most 7 slides.** Going over makes the project ineligible for global judging.
- **Links must be public**, with no login.
- **The work must be original** and done by the registered team.

### When you are stuck

Spend at most 20 minutes stuck on one thing. Then post in the team chat: what you are trying to do, what you tried, and the exact error.

---

## 10. Task sheets

Each sheet lists steps in order. Do them in order. Each step has a check. A step is done when its check passes and the work is merged.

### Yuvi: data

You turn NASA's files into the tables everyone else reads. Your work is on the critical path: nothing real appears on screen until your tables exist.

**Step 0. Repo skeleton and fixtures (first 30 minutes, straight to `main`).**
1. Create the root files: `.env.example`, `CLAUDE.md`, a short `README.md`, `docs/AI_USE.md` with the table header from section 14. (`.gitignore` comes from the next item.)
2. Create `pipeline/requirements.txt` (section 3). Save `extract_starter.py` from the top of Appendix A in the repo root and run `python extract_starter.py .gitignore pipeline`. That writes `.gitignore` and `pipeline/config.py`, `make_fixtures.py`, `build.py`, `harmonize.py` exactly. Commit `extract_starter.py` too, so the others can use it.
3. Run `python pipeline/make_fixtures.py`, then `python pipeline/build.py --fixtures`.
4. Commit everything including `data/fixtures/`, push, and tell the team the fixtures are on `main`.

Check: `build.py --fixtures` prints row counts for Terra, Aqua, SNPP and NOAA20, and "Rows with a missing or negative harmonized_count: 0". `data/fixtures/` has `points/`, `grid_counts.parquet`, `grid.parquet`, `harmonization.json`.

Start step 1's download in a second terminal before you begin step 0. It runs by itself.

**Step 1. `pipeline/download.py`.** Downloads the yearly files in section 5.1 into `data/raw/<source>/`. Arguments: `--country` (default `canada`), `--years 2023` or `--years 2003-2025`, `--sources modis,viirs-snpp`. Skips a file that already exists with a size above zero. Downloads to a temporary name and renames when complete, so a broken download never looks finished. Prints each file and its size. Uses `httpx` streaming with a 10 minute timeout.
Download in this order: (a) Canada 2023, MODIS and Suomi NPP. (b) Canada 2003 to 2025, MODIS and Suomi NPP. (c) Canada NOAA-20, 2018 to 2025.

Check: `python pipeline/download.py --country canada --years 2023 --sources modis,viirs-snpp` leaves two files of about 26 MB and 141 MB. Running it again downloads nothing.

**Step 2. First real build.** With 2023 downloaded, run `python pipeline/build.py`. Tell the team as soon as `data/processed/` exists, and share the folder (zip it and put it where the team can fetch it, because it is not in git).

Check: the report shows around a million or more SNPP detections for 2023, and several times fewer for MODIS.

**Step 3. Full Canada.** Download (b), rebuild, share again. Write `docs/DATA_NOTES.md`: what was downloaded and when, row counts per satellite per year, and anything odd.

Check: row counts per year look sensible. 2023 is the largest year by a wide margin. No year from 2003 to 2025 is missing for MODIS, and none from 2012 for SNPP.

**Step 4. 2026.** Add the archive request files as described in section 5.1. Rebuild.

Check: `harmonization.json` has `data_through` in November 2026. SNPP's last date is 2026-11-02 or earlier. NOAA20 has rows in November 2026.

**Step 5. NOAA-20 history.** Download (c), rebuild. Andrew L needs this for the handoff ratio.

**Step 6. India, then Brazil.** Same steps with `--country india` and `--country brazil`. Brazil is 3.2 GB. Start it only when Canada is completely done, and stop if the build takes more than a few minutes or a laptop runs short of disk.

**Step 7. Join the frontend.** Section 13, items 1 and 2: the trend chart and the plain-language summary, in `frontend/src/components/trend/` and `summary/`.

Definition of done for the data: section 12, checks D1 to D6.

### Andrew L: harmonization, validation, ML, checkpoint checks

You own the number that the whole app is about, and the evidence that it is right.

**Step 1. Explore.** When `data/processed/grid_counts.parquet` exists for Canada, look at the Suomi NPP to MODIS ratio by calendar month and by region. Note what varies. Write three sentences in `docs/METHOD.md`.

**Step 2. The ratio method.** Replace the inside of `run()` in `pipeline/harmonize.py` (keep its inputs and outputs, section 6).
- For each 1 degree block (`floor(cell_x / 10.0)`, `floor(cell_y / 10.0)`) and each calendar month, `ratio = sum(snpp_count) / sum(modis_count)` over the training months.
- Use the block's ratio only when the block has at least 50 MODIS detections in that calendar month over the training years. Otherwise use the country's ratio for that calendar month, and if that is thin too, the country's overall ratio.
- `modis` era: `harmonized_count = modis_count * ratio`.
- A cell that MODIS never saw gets 0 in the `modis` era. That is accepted: the block ratio already accounts for those fires in the total.
- NOAA-20 handoff: `handoff_ratio_noaa20 = sum(snpp_count) / sum(noaa20_count)` over months 201804 to 202510, per country. `noaa20` era: `harmonized_count = noaa20_count * handoff_ratio`.
- Set `"method": "ratio"` in `harmonization.json`.

Check: for a few boxes, the harmonized yearly totals for 2010, 2011 are in the same range as 2013, 2014, while the raw totals jump by several times.

**Step 3. `pipeline/validate.py`.** Learn ratios on 2012 to 2019 only. Apply them to MODIS for 2020 to 2025. For each country and month compare the estimate with what Suomi NPP reported. Report the median absolute percentage error of monthly totals for raw MODIS and for the harmonized estimate, and the same for yearly totals. Put the two headline numbers in `harmonization.json` under `validation`, and the full table in `docs/METHOD.md`. After validating, the final ratios are learned on all overlap years.
When trying different settings or inputs for either method, compare them inside 2012 to 2019 only, by leaving one year out at a time. Use 2020 to 2025 only for the final numbers and for the final comparison between the ratio method and the ML model, never for tuning.

Check: `python pipeline/validate.py` prints both errors, and the harmonized error is far smaller than the raw error.

**Step 4. ML model, `pipeline/ml_model.py`.** Predict `snpp_count` for a cell and month from features available before 2012: `modis_count`, `modis_frp_sum`, month, cell centre latitude and longitude, and the MODIS counts of the neighbouring cells. Other features are allowed when they come from MODIS detections alone, for example Terra and Aqua counts separately, or day and night counts separately, both taken from `points`. Train on 2012 to 2019, test on 2020 to 2025. Split by year, never at random. Use `HistGradientBoostingRegressor(loss="poisson")`. Compare its error with the ratio method on the same test years, at the same level (monthly totals per country).
The model replaces the ratio only if it is clearly better on the held-out years. If it is not better or not finished by Saturday 20:00, the ratio method ships and the ML result goes in `docs/METHOD.md` as something we tested.

**Step 5. Checkpoint checks.** At each checkpoint in section 11, run section 12 on `main`. Open a GitHub issue for each failure, naming the check id and the owner.

**Step 6. The demo.** Write the 30 second script from section 2 and rehearse it on real data.

### Angela: backend core

You build the server and the endpoints for the calendar, the map and the downloads.

**Step 0. Scaffold (first 40 minutes, straight to `main`).** Create `backend/requirements.txt` (section 3). From the repo root run `python extract_starter.py backend` (copy the script from the top of Appendix A if it is not on `main` yet). That writes `app/main.py`, `config.py`, `db.py`, `deps.py`, `tests/conftest.py` and `pytest.ini` exactly. Add empty `__init__.py` files in `app/`, `app/routers/` and `app/analysis/`. Until the fixtures are on `main`, make them yourself locally with `python extract_starter.py pipeline`, `python pipeline/make_fixtures.py` and `python pipeline/build.py --fixtures`. Do not commit those.

Check: `uvicorn app.main:app --reload --port 8000` starts, and `/api/health` returns `{"status": "ok"}`. `pytest` runs from the `backend` folder (it finds no tests yet, which is fine).

**Step 1. `routers/meta.py`** and `tests/test_meta.py`.

Check: on fixtures, `last_month` is `2026-11`, `last_complete_month` is `2026-10`, `data_through` is `2026-11-06`, and the first preset is `fixture`.

**Step 2. `routers/calendar.py`** with `/calendar` and `/calendar.csv`, and `tests/test_calendar.py`.

Check, on the fixture box for 2003 to 2026: 287 months, in order. Every month up to January 2012 has `viirs` null and `raw` equal to `modis`. Every month from February 2012 to October 2026 has `harmonized` equal to `viirs`. The last month has `complete` false. July 2023 is far above July 2022.

**Step 3. `routers/grid.py`** and `tests/test_grid.py`.

Check: for the fixture box and one month with `step` 1, the cell values add up to that month's `harmonized` in `/calendar` (within 0.1 per cell of rounding). With `step` 10 the box gives at most 4 cells and the same total.

**Step 4. `routers/export.py`** with `/points/count` and `/points.csv`, and `tests/test_export.py`.

Check: for the fixture box and July 2023, the count with `sensor=viirs` equals `viirs` in `/calendar` and the count with `sensor=modis` equals `modis`. The CSV has the header row from section 7 and exactly that many data lines.

**Step 5. Real data.** When `data/processed/` arrives, run every check again on it with a box in the Northwest Territories. Time each endpoint. Anything slower than 2 seconds for the "All of Canada" preset gets looked at.

**Step 6.** Help Andrew N wire his routers. Then section 13.

Definition of done: section 12, checks B1 to B8.

### Andrew N: backend analysis

You build the comparison with the historical median, then trends and anomalies.

**Step 0. `backend/app/analysis/stats.py`** and `tests/test_stats.py`. Pure functions with no database and no FastAPI, so you can start before anything else exists:

```python
def compare_stats(target: float, history: list[float]) -> dict:
    """Returns median, p25, p75, min, max, absolute, percent, rank, of, percentile, label.
    Exactly the rules under GET /api/compare in section 7."""

def linear_trend(years: list[int], values: list[float]) -> dict:
    """Returns slope_per_year, percent_per_decade, p_value, direction. Section 7, GET /api/trend."""
```

Check, by hand-worked cases in the tests: `compare_stats(30, [10, 20, 30, 40])` gives median 25.0, p25 17.5, p75 32.5, absolute 5.0, percent 20.0, rank 2, of 5, percentile 50.0, label "near normal". A history of all zeros with target 5 gives percent None, rank 1 and percentile 100.0. `linear_trend([2003, 2004, 2005, 2006], [10, 20, 30, 40])` gives slope 10.0 and direction "increasing".

**Step 1. `routers/compare.py`** and `tests/test_compare.py`, once Angela's scaffold is on `main`. Copy `main.py`'s pattern: define `router = APIRouter()` and it is picked up automatically.

Check, on the fixture box: with no `year` and `month` the target is October 2026. `target.harmonized` equals that month in `/calendar`. `history` has one entry per year from 2003 to 2025. The median equals the median you compute by hand from `/calendar`'s Octobers. Asking for November 2026 gives `complete` false and `days_covered` 6. Asking for only `year` gives 400.

**Step 2. `routers/trend.py`** and `tests/test_trend.py`.

Check, on the fixture box: 23 years, 2003 to 2025. The yearly totals equal the sums from `/calendar`. `raw_trend.slope_per_year` is much larger than `harmonized_trend.slope_per_year`, because of the sensor change.

**Step 3. `routers/anomaly.py`** and `tests/test_anomaly.py`.

**Step 4. Real data.** Rerun your checks on `data/processed/` with a real box.

Definition of done: section 12, checks B9 to B12.

### Vlad: frontend shell, map, region selection

You build the page everyone else's components sit in, the globe, and the way a user picks an area.

**Step 0. Scaffold (first 40 minutes, straight to `main`).**
1. `npm create vite@latest frontend -- --template react-ts`, then install `maplibre-gl`, `zustand`, `@tanstack/react-query`, `recharts`, `d3-scale-chromatic`, `@types/d3-scale-chromatic`, `tailwindcss`, `@tailwindcss/vite`.
2. Set up Tailwind 4: add `tailwindcss()` from `@tailwindcss/vite` to the plugins in `vite.config.ts`, and put `@import "tailwindcss";` at the top of the main CSS file. There is no `tailwind.config.js` in version 4. Add the `/api` proxy from section 3.
3. From the repo root run `python extract_starter.py frontend` (copy the script from the top of Appendix A if it is not on `main` yet). That writes `src/api/types.ts`, `mock.ts`, `client.ts` and `src/state/store.ts` exactly. Do this after `npm create vite`, not before.
4. `App.tsx` with the layout from section 8, a placeholder map area, and an empty `components/Sidebar.tsx` that Sam takes over. Wrap the app in a `QueryClientProvider`.
5. `frontend/.env.local` with `VITE_USE_MOCKS=1` (not committed), and `frontend/.env.example` with the two names.

Check: `npm run dev` shows the layout. `npm run build` passes with no TypeScript errors.

**Step 1. `src/api/hooks.ts` and `src/lib/geo.ts`** (`snapBbox`, and `cellsToGeoJSON(cells, step)` which returns a GeoJSON FeatureCollection of squares with `value` on each).

Check: `snapBbox({west: -114.35, south: 62.41, east: -114.31, north: 62.44})` returns `{west: -114.4, south: 62.4, east: -114.3, north: 62.5}`.

**Step 2. The globe.** `MapView` with the dark style and globe projection.

**Step 3. Fire cells and legend,** using `useGrid` and Sam's `colors.ts`. Until `colors.ts` is merged, use a temporary two-colour scale and replace it afterwards.

**Step 4. Region selection.** Presets, the four inputs, the draw tool, the outline, fit to bounds.

Check: drawing a box, typing a box and clicking a preset all end with the same thing: the snapped box in the store, the outline on the map, the inputs showing it, and the sidebar updating.

**Step 5. Switch to the real backend.** Remove `VITE_USE_MOCKS`, run against the backend on fixtures, then on real data.

**Step 6. Polish.** The opening view, the fly animation, loading and error states. Then section 13.

Definition of done: section 12, checks U1 to U4.

### Sam: calendar, comparison, downloads, visual quality, submission

You build what the user reads: the calendar, the comparison and the downloads. You also own how it all looks, and the submission page.

**Step 0. `src/theme.css` and `src/lib/colors.ts`** (section 8), `src/lib/format.ts` (number formatting with thousands separators, month names). You can write these before the scaffold exists. Vlad's map needs `colors.ts`, so merge it first.

Check: `rampStops("fire", 5)` returns five colours from dark to light, and the first one is clearly visible on `--panel`.

**Step 1. The calendar,** against the mock API (`VITE_USE_MOCKS=1`).

Check: with the preset box selected, 24 rows by 12 columns appear. Switching to Raw makes the rows from 2012 on look much brighter than the rows before. Tab reaches the cells and each announces its month and count.

**Step 2. Controls:** the Harmonized or Raw switch, the year range, the ramp switch.

**Step 3. The compare panel.**

**Step 4. Downloads** and `src/lib/download.ts`.

Check: the PNG opens and is readable. The CSV link downloads a file from the real backend.

**Step 5. Real backend, real data.** Go through section 8's accessibility list item by item.

**Step 6. Submission.** `docs/SUBMISSION.md` with every field in section 14, then the slides or video. Start the text on Saturday evening. Do not leave it for Sunday night.

Definition of done: section 12, checks U5 to U10, and section 14.

---

## 11. Timeline and checkpoints

Submission opens Saturday 9:00 and closes Sunday 23:59. **Ask the Toronto organizers at the opening when local judging happens.** If it is earlier than Sunday evening, every Sunday time below moves earlier by the same amount.

| When | Checkpoint | What is true |
|---|---|---|
| Sat 10:00 | C0 Skeleton | Fixtures on `main`. Backend answers `/api/health`. Frontend scaffold runs on the mock API. |
| Sat 12:30 | C1 First slice | One real year (Canada 2023) is built. `/api/calendar` works on fixtures. The calendar and the globe show on screen from mock or fixture data. |
| Sat 17:00 | C2 Real Canada | Canada 2003 to 2025 built. Frontend runs on the real backend. Calendar, map and box selection work end to end. |
| Sat 20:00 | ML decision | The ML model is in only if it beat the ratio method on held-out years. Otherwise it stops here. |
| Sat 22:00 | C3 All six features | F1 to F6 work on real Canada data, including 2026 and the NOAA-20 handoff. Validation numbers are in `docs/METHOD.md`. |
| Sun 10:00 | C4 Wider and cleaner | India and Brazil loaded or dropped. First full run of the demo. Submission text drafted. |
| Sun 13:00 | C5 Feature freeze | Only bug fixes, the write-up and the demo after this. |
| Sun 17:00 | C6 Submitted | The project page is complete and submitted. It can be edited and resubmitted until the deadline. |

At each checkpoint Andrew L runs section 12 on `main` and posts what passed and what did not. A part that is behind at a checkpoint says so early, so the plan can change while there is still time.

---

## 12. How work is checked

These checks are run on `main` at every checkpoint, and by you on your own branch before you merge. If a check fails, the work is not done, whatever else is true.

### Data

- **D1.** `python pipeline/build.py --fixtures` runs clean from a fresh clone.
- **D2.** `grid.parquet` has no two rows with the same `cell_x`, `cell_y`, `year`, `month`.
- **D3.** All counts are 0 or more. `harmonized_count` is never null or negative.
- **D4.** `snpp_count` is 0 for every month before 201201. `noaa20_count` is 0 before 201804.
- **D5.** In the `snpp` era, `harmonized_count` equals `snpp_count` in every row.
- **D6.** For any month, the number of rows in `points` for a sensor equals the matching sum in `grid`: MODIS rows equal `sum(modis_count)`, and VIIRS rows equal the sum of that era's VIIRS count (`snpp_count` in the `snpp` era, `noaa20_count` in the `noaa20` era, no VIIRS rows in the `modis` era).

### Backend

- **B1.** `pytest`, run from the `backend` folder, passes on the fixtures.
- **B2.** Every response has exactly the field names in `types.ts`. No extra top-level fields, none missing.
- **B3.** `/api/calendar` is dense and ordered (287 months for 2003 to 2026 on current data).
- **B4.** In the `modis` era `viirs` is null and `raw` equals `modis`. In the `snpp` era `harmonized` equals `viirs`.
- **B5.** `/api/grid` cell values for one month add up to that month's `harmonized` in `/api/calendar`, at every `step`.
- **B6.** `/api/points/count` by sensor equals `modis` and `viirs` in `/api/calendar` for the same box and month.
- **B7.** The returned `bbox` contains the requested box, and its edges are multiples of 0.1.
- **B8.** A box with west not below east returns 400 with a `detail`. A missing parameter returns 422.
- **B9.** `/api/compare`: `target.harmonized` and every `history` value equal the same months in `/api/calendar`.
- **B10.** `/api/compare`: the median, percent, rank and label follow section 7, checked by recomputing from `history`.
- **B11.** `/api/compare` on the current month returns `complete: false` and does not scale the count.
- **B12.** `/api/trend`: yearly totals equal sums from `/api/calendar`.

### Frontend

- **U1.** `npm run build` passes with no TypeScript errors and no use of `any` in the shared files.
- **U2.** No component calls `fetch` directly, and no component hard-codes a field name that is not in `types.ts`.
- **U3.** Drawing a box, typing a box and choosing a preset all give the same snapped box and update every panel.
- **U4.** The map shows fire cells for the selected period and a legend with real numbers.
- **U5.** The calendar shows every month, marks the partial month, and marks the era changes.
- **U6.** The Harmonized or Raw switch changes the calendar, and the false jump at 2012 is visible in raw mode on real data.
- **U7.** The compare panel shows the same numbers as `/api/compare` for the same month.
- **U8.** Both CSV downloads and both PNG downloads work.
- **U9.** Everything works by keyboard. Focus is always visible.
- **U10.** The page works with `VITE_USE_MOCKS=1` and with the real backend.

### The whole thing

- **E1.** The demo in section 2 runs start to finish on real data without a reload.
- **E2.** `docs/AI_USE.md` has entries from every teammate.
- **E3.** No key and no data file outside `data/fixtures/` is in the repo history.

---

## 13. Extras, in order

Start these only when your own part passes its checks. Take them in this order and finish one before starting the next. Nothing here may put F1 to F6 at risk.

1. **Trend chart** (Yuvi, with Andrew N's `/api/trend`). Yearly totals for the box, harmonized against raw, with the trend sentence. Shows that the raw record invents a rise.
2. **Plain-language summary** (Yuvi). Three or four sentences built from the numbers by a fixed template, not by an AI model: the busiest year, the usual peak month, how this month compares, and the trend.
3. **Anomaly map** (Vlad, with Andrew N's `/api/anomaly`). Colour each cell by how unusual the selected month is. Use a diverging blue to orange ramp, which is safe for colour vision deficiency.
4. **Uncertainty band** (Andrew L and Sam). Show the range of the estimate for months in the `modis` era, from the validation error.
5. **Fire season shift** (Yuvi). One sentence and a small chart from `season_shift` in `/api/trend`.
6. **Briefing page** (Sam). A print stylesheet so the sidebar prints as a one-page report.
7. **Compare two areas or two years** side by side.
8. **Fire regime map** (Andrew L). Cluster cells by the shape of their fire year with k-means and colour the map by cluster.
9. **Time-lapse** (Vlad). A Play button on the map steps through every month from January of `startYear` to December of `endYear`, stopping at `last_month`, about four months a second. Each step calls `setSelected`, so the map, the calendar's outlined cell and the compare panel all follow. A strip under the map shows the months of that range with the three eras shaded and a marker at each handoff (February 2012 and November 2026), labelled from `useMeta().eras`. Dragging its handle scrubs month by month, and the current month is written beside it, for example "July 2023". Before the first frame it loads every month of the range through the same query as `useGrid`, showing progress, and fixes the hatch scale to the largest single-month cell value in the range, so a quiet month never looks as fierce as a big one. Pause, a click in the calendar, a new box or the end of the range stops it and leaves the last month selected. It starts only when the user presses Play, works by keyboard, and steps once a second under `prefers-reduced-motion`. It uses only existing endpoints and changes no contract. Files in `frontend/src/components/map/`. Meant as a shot for the demo video.
10. **Deploy.** Frontend on a static host, backend on a small server with the grid and Canada's points. Only after the feature freeze, and only if the local demo is solid.

Not on the list and not to be built: fire forecasting, smoke or weather layers, real alerts, deep learning on images, polygon drawing.

---

## 14. Submission

Sam drafts these in `docs/SUBMISSION.md`. Andrew L supplies the method and numbers. Everyone reads the final text before it is submitted.

| Field on the project page | What goes in it |
|---|---|
| Project name | The final name |
| High-level summary | What we built, how it answers the challenge, why it matters. Four or five sentences. |
| Link to project demo | A video of **30 seconds or less**, or **at most 7 slides**, on a public link that needs no login |
| Link to final project | The public GitHub repo, and the live site if there is one |
| Detailed description | What it does, how it works, the method and its validation numbers, benefits, tools and languages |
| Use of AI tools | Where and how AI tools were used, from `docs/AI_USE.md`. The form calls this "SI". |
| NASA data | FIRMS MODIS Collection 6.1 active fire data, FIRMS VIIRS 375 m active fire data from Suomi NPP and NOAA-20, with links |
| Other references | MapLibre, the basemap provider, DuckDB, and every library and data source used |

Before submitting: tick "Terms and Conditions" and "Confirm All Work is Original", then "Submit for Judging". Check the public links in a private browser window.

`docs/AI_USE.md` starts like this:

```markdown
# AI use

| When | Who | Tool | What it produced | How a person checked it |
|---|---|---|---|---|
| Sat 09:20 | Yuvi | Claude Code | pipeline/download.py | Ran it for Canada 2023 and compared file sizes with the FIRMS listing |
```

---

## 15. Glossary

- **Hot spot, detection.** One satellite pixel flagged as containing a fire at one moment. A big fire is many hot spots over many days.
- **MODIS.** The older instrument, on the Terra and Aqua satellites. Pixels about 1 km across.
- **VIIRS.** The newer instrument, on Suomi NPP, NOAA-20 and NOAA-21. Pixels 375 m across.
- **Suomi NPP, S-NPP, SNPP.** The first VIIRS satellite, 2012 to 2 November 2026. Our reference scale.
- **NOAA-20.** The second VIIRS satellite, from 2018. FIRMS calls its folder `viirs-jpss1`. It carries the record from November 2026.
- **FIRMS.** NASA's service that publishes the hot spots.
- **FRP.** Fire radiative power, in megawatts. How strongly a fire pixel is burning.
- **Harmonized.** Converted so that counts from different instruments can be compared directly.
- **Raw.** Counted as the satellites reported it: MODIS before February 2012, VIIRS after.
- **Era.** One of the three periods in section 5.5.
- **Cell.** A 0.1 by 0.1 degree square, about 11 km north to south.
- **Box, bbox.** The rectangle the user selected, snapped outward to whole cells.
- **Baseline.** The other years a month is compared with.
- **Fixtures.** The small fake data set in `data/fixtures/`.
- **Near-real-time, NRT.** Recent data that has not yet been through NASA's final quality processing.

---

## Appendix A. Starter files, copied exactly

Each file below goes to the path in its heading, character for character. Section 0, rule 5 says what to do if one of them has a bug.

**Do not retype these files.** Save the script below as `extract_starter.py` in the repo root and run it. It reads this file and writes the starter files exactly. You only need the files under the folders your human owns.

```python
"""Write the starter files from Appendix A of MASTERSPEC.md, exactly as they appear there.

Run from the repo root:
    python extract_starter.py                        every file
    python extract_starter.py backend                only paths that start with "backend"
    python extract_starter.py .gitignore pipeline    several prefixes
A file that already exists is left alone.
"""
import re
import sys
from pathlib import Path

HEADING = "## Appendix A. " + "Starter files, copied exactly"
spec = Path("MASTERSPEC.md").read_text(encoding="utf-8")
appendix = spec.split("\n" + HEADING + "\n", 1)[1]
wanted = sys.argv[1:]
for path, code in re.findall(r"^### `([^`]+)`\n\n```[a-z]*\n(.*?)\n```$", appendix, flags=re.S | re.M):
    if wanted and not any(path.startswith(prefix) for prefix in wanted):
        continue
    target = Path(path)
    if target.exists():
        print("kept ", path)
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(code + "\n", encoding="utf-8", newline="\n")
    print("wrote", path)
```

The rest of this appendix is the files themselves.

### `.gitignore`

```text
# Data: only the small fake fixtures are committed
data/raw/
data/interim/
data/processed/
*.duckdb
*.duckdb.wal

# Secrets
.env
.env.local

# Python
.venv/
__pycache__/
*.pyc
.pytest_cache/

# Node
node_modules/
dist/

# Editors and operating systems
.vscode/
.idea/
.DS_Store
Thumbs.db
```

### `pipeline/config.py`

```python
"""Constants shared by every pipeline script.

Copied from MASTERSPEC.md Appendix A. Change only with team agreement.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
INTERIM_DIR = ROOT / "data" / "interim"
PROCESSED_DIR = ROOT / "data" / "processed"
FIXTURES_DIR = ROOT / "data" / "fixtures"

FIRMS_COUNTRY_BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"

# FIRMS folder name -> what it holds and which yearly files exist
SOURCES = {
    "modis": {"sensor": "MODIS", "first_year": 2003, "last_year": 2025},
    "viirs-snpp": {"sensor": "VIIRS", "first_year": 2012, "last_year": 2025},
    "viirs-jpss1": {"sensor": "VIIRS", "first_year": 2018, "last_year": 2025},
}

# our id -> the name FIRMS uses in file names
COUNTRIES = {"canada": "Canada", "india": "India", "brazil": "Brazil"}

# Months are compared as year * 100 + month, for example 201201 is January 2012.
FIRST_YM = 200301          # first month in every table
MODIS_ERA_END_YM = 201201  # up to here the record is MODIS scaled to match VIIRS
SNPP_ERA_END_YM = 202610   # up to here the record is VIIRS on Suomi NPP, as observed
#                            after that it is VIIRS on NOAA-20 times the handoff ratio

MODIS_MIN_CONFIDENCE = 30  # MODIS detections below this are low confidence and dropped
```

### `pipeline/make_fixtures.py`

```python
"""Write small fake FIRMS-format CSV files so everyone can work before real data exists.

Usage, from the repo root:   python pipeline/make_fixtures.py
Output:                      data/fixtures/raw/<source>/<source>_<year>_Canada.csv

The numbers are invented. Only the file shape matches the real FIRMS files.
Uses the standard library only, and always writes the same files.
"""
import calendar
import csv
import random
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "fixtures" / "raw"

# A 2 x 2 degree box near Yellowknife: longitude -116 to -114, latitude 61 to 63.
WEST, SOUTH, SIZE = -116.0, 61.0, 2.0
SEASON = [0, 0, 0.02, 0.2, 1.0, 2.5, 4.0, 3.0, 1.0, 0.2, 0.02, 0]  # January to December
BIG_YEARS = {2004: 2.0, 2014: 3.0, 2017: 1.8, 2023: 5.0}
MODIS_PER_MONTH = 12       # average MODIS detections in a peak-free month with season weight 1
VIIRS_PER_MODIS = 4.5      # VIIRS sees several times more hot spots than MODIS
LAST_DAY = date(2026, 11, 6)

MODIS_HEADER = (
    "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,"
    "instrument,confidence,version,bright_t31,frp,daynight,type"
).split(",")
VIIRS_HEADER = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,"
    "instrument,confidence,version,bright_ti5,frp,daynight,type"
).split(",")

# source folder -> (first day with data, last day with data)
SOURCES = {
    "modis": (date(2003, 1, 1), LAST_DAY),
    "viirs-snpp": (date(2012, 1, 20), date(2026, 11, 2)),
    "viirs-jpss1": (date(2018, 4, 1), LAST_DAY),
}


def month_plan(rng):
    """For every month, pick how busy it is and where the fires are. Shared by all sources."""
    plan = {}
    for year in range(2003, 2027):
        year_factor = BIG_YEARS.get(year, 1.0) * rng.uniform(0.6, 1.4)
        for month in range(1, 13):
            centres = [
                (WEST + rng.uniform(0.2, SIZE - 0.2), SOUTH + rng.uniform(0.2, SIZE - 0.2))
                for _ in range(3)
            ]
            plan[(year, month)] = (MODIS_PER_MONTH * SEASON[month - 1] * year_factor, centres)
    return plan


def draw_count(rng, mean):
    if mean <= 0:
        return 0
    return max(0, int(round(rng.gauss(mean, mean ** 0.5))))


def modis_row(rng, lat, lon, day, nrt):
    confidence = rng.choice([20, 45, 60, 75, 85, 95, 100])  # 20 is low confidence and must be dropped
    satellite = rng.choice(["Terra", "Aqua"])
    return [
        f"{lat:.4f}", f"{lon:.4f}", f"{rng.uniform(300, 360):.1f}", "1.2", "1.1",
        day.isoformat(), f"{rng.randrange(0, 24):02d}{rng.randrange(0, 60):02d}",
        satellite[0] if nrt else satellite, "MODIS", confidence,
        "6.1NRT" if nrt else "6.1", f"{rng.uniform(270, 300):.1f}", f"{rng.uniform(5, 300):.1f}",
        rng.choice(["D", "N"]), "" if nrt else rng.choice([0, 0, 0, 0, 0, 0, 0, 0, 0, 2]),
    ]


def viirs_row(rng, lat, lon, day, nrt, satellite_code):
    letter = rng.choice(["l", "n", "n", "n", "n", "h", "h"])  # l is low confidence and must be dropped
    confidence = {"l": "low", "n": "nominal", "h": "high"}[letter] if nrt else letter
    return [
        f"{lat:.5f}", f"{lon:.5f}", f"{rng.uniform(300, 367):.2f}", "0.4", "0.4",
        day.isoformat(), f"{rng.randrange(0, 24):02d}{rng.randrange(0, 60):02d}",
        satellite_code, "VIIRS", confidence,
        "2.0NRT" if nrt else "2", f"{rng.uniform(260, 300):.2f}", f"{rng.uniform(0.5, 80):.2f}",
        rng.choice(["D", "N"]), "" if nrt else rng.choice([0, 0, 0, 0, 0, 0, 0, 0, 0, 2]),
    ]


def main():
    plan_rng = random.Random(20261114)
    plan = month_plan(plan_rng)
    total = 0
    for source, (first_day, last_day) in SOURCES.items():
        rng = random.Random(f"fire-almanac-{source}")
        header = MODIS_HEADER if source == "modis" else VIIRS_HEADER
        scale = 1.0 if source == "modis" else VIIRS_PER_MODIS
        satellite_code = {"viirs-snpp": "N", "viirs-jpss1": "N20"}.get(source)
        folder = OUT / source
        folder.mkdir(parents=True, exist_ok=True)
        for year in range(first_day.year, last_day.year + 1):
            rows = []
            for month in range(1, 13):
                mean, centres = plan[(year, month)]
                days_in_month = calendar.monthrange(year, month)[1]
                for _ in range(draw_count(rng, mean * scale)):
                    day = date(year, month, rng.randrange(1, days_in_month + 1))
                    if day < first_day or day > last_day:
                        continue
                    centre_lon, centre_lat = rng.choice(centres)
                    lon = min(max(centre_lon + rng.gauss(0, 0.08), WEST + 0.001), WEST + SIZE - 0.001)
                    lat = min(max(centre_lat + rng.gauss(0, 0.08), SOUTH + 0.001), SOUTH + SIZE - 0.001)
                    nrt = day >= date(2026, 7, 1)  # recent months look like near-real-time files
                    if source == "modis":
                        rows.append(modis_row(rng, lat, lon, day, nrt))
                    else:
                        rows.append(viirs_row(rng, lat, lon, day, nrt, satellite_code))
            if year == 2026:
                # A few fixed detections on 1 to 6 November so the current month is never empty.
                for day_of_month in range(1, 7):
                    day = date(2026, 11, day_of_month)
                    if day < first_day or day > last_day:
                        continue
                    for _ in range(1 if source == "modis" else 4):
                        lon = -115.0 + rng.gauss(0, 0.05)
                        lat = 62.0 + rng.gauss(0, 0.05)
                        if source == "modis":
                            rows.append(modis_row(rng, lat, lon, day, True))
                        else:
                            rows.append(viirs_row(rng, lat, lon, day, True, satellite_code))
            rows.sort(key=lambda r: (r[5], r[6]))
            path = folder / f"{source}_{year}_Canada.csv"
            with open(path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle, lineterminator="\n")
                writer.writerow(header)
                writer.writerows(rows)
            total += len(rows)
    print(f"Wrote {total} fake detections under {OUT}")


if __name__ == "__main__":
    main()
```

### `pipeline/build.py`

```python
"""Turn raw FIRMS CSV files into the tables the backend reads.

Usage, from the repo root:
    python pipeline/build.py --fixtures     fake data  -> data/fixtures
    python pipeline/build.py                real data  -> data/processed

Reads   <raw>/<source>/<source>_<year>_<Country>.csv
        where source is modis, viirs-snpp or viirs-jpss1
Writes  <out>/points/year=YYYY/*.parquet
        <out>/grid_counts.parquet
        <out>/grid.parquet
        <out>/harmonization.json

The SQL in this file is the definition of the cleaning rules and the grid.
Copied from MASTERSPEC.md Appendix A. Change the rules only with team agreement.
"""
import argparse
import shutil

import duckdb

import config
import harmonize

CSV_TYPES = (
    "{'latitude': 'DOUBLE', 'longitude': 'DOUBLE', 'acq_date': 'DATE', 'acq_time': 'VARCHAR', "
    "'satellite': 'VARCHAR', 'confidence': 'VARCHAR', 'version': 'VARCHAR', 'frp': 'DOUBLE'}"
)

SATELLITE_SQL = {
    "modis": "CASE upper(substr(satellite, 1, 1)) WHEN 'T' THEN 'Terra' ELSE 'Aqua' END",
    "viirs-snpp": "'SNPP'",
    "viirs-jpss1": "'NOAA20'",
}
MODIS_CONFIDENCE = "CASE WHEN TRY_CAST(confidence AS INTEGER) >= 80 THEN 'high' ELSE 'nominal' END"
MODIS_KEEP = f"TRY_CAST(confidence AS INTEGER) >= {config.MODIS_MIN_CONFIDENCE}"
VIIRS_CONFIDENCE = "CASE lower(substr(confidence, 1, 1)) WHEN 'h' THEN 'high' ELSE 'nominal' END"
VIIRS_KEEP = "lower(substr(confidence, 1, 1)) IN ('n', 'h')"


def load_clean(con, raw_dir):
    """Read every raw file into one table, applying the cleaning rules."""
    con.execute(
        """
        CREATE OR REPLACE TABLE clean (
            latitude DOUBLE, longitude DOUBLE, acq_date DATE, acq_time VARCHAR,
            sensor VARCHAR, satellite VARCHAR, confidence VARCHAR, frp DOUBLE, daynight VARCHAR,
            country VARCHAR, cell_x INTEGER, cell_y INTEGER, year INTEGER, month INTEGER
        )
        """
    )
    for source, info in config.SOURCES.items():
        folder = raw_dir / source
        if not list(folder.glob("*.csv")):
            print(f"  {source}: no files found, skipped")
            continue
        is_modis = source == "modis"
        con.execute(
            f"""
            INSERT INTO clean
            SELECT
                latitude,
                longitude,
                acq_date,
                lpad(acq_time, 4, '0'),
                '{info["sensor"]}',
                {SATELLITE_SQL[source]},
                {MODIS_CONFIDENCE if is_modis else VIIRS_CONFIDENCE},
                frp,
                upper(substr(daynight, 1, 1)),
                lower(regexp_extract(filename, '_([A-Za-z]+)[.]csv$', 1)),
                CAST(floor(round(longitude * 10, 6)) AS INTEGER),
                CAST(floor(round(latitude * 10, 6)) AS INTEGER),
                year(acq_date),
                month(acq_date)
            FROM read_csv('{folder.as_posix()}/*.csv', header = true, union_by_name = true,
                          filename = true, types = {CSV_TYPES})
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND acq_date IS NOT NULL
              AND ("type" IS NULL OR "type" = 0)
              AND {MODIS_KEEP if is_modis else VIIRS_KEEP}
              AND year(acq_date) * 100 + month(acq_date) >= {config.FIRST_YM}
            """
        )
        print(f"  {source}: loaded")


def write_points(con, out_dir):
    """The detections the app serves: the ones the raw record counts in each era."""
    target = out_dir / "points"
    if target.exists():
        shutil.rmtree(target)
    con.execute(
        f"""
        COPY (
            SELECT * FROM clean
            WHERE sensor = 'MODIS'
               OR (satellite = 'SNPP'
                   AND year * 100 + month > {config.MODIS_ERA_END_YM}
                   AND year * 100 + month <= {config.SNPP_ERA_END_YM})
               OR (satellite = 'NOAA20' AND year * 100 + month > {config.SNPP_ERA_END_YM})
            ORDER BY acq_date, acq_time
        ) TO '{target.as_posix()}' (FORMAT PARQUET, PARTITION_BY (year))
        """
    )


def build_grid_counts(con):
    """One row per 0.1 degree cell and month, with what each satellite saw."""
    con.execute(
        """
        CREATE OR REPLACE TABLE grid_counts AS
        SELECT
            cell_x,
            cell_y,
            year,
            month,
            min(country) AS country,
            CAST(count(*) FILTER (WHERE sensor = 'MODIS') AS INTEGER) AS modis_count,
            CAST(count(*) FILTER (WHERE satellite = 'SNPP') AS INTEGER) AS snpp_count,
            CAST(count(*) FILTER (WHERE satellite = 'NOAA20') AS INTEGER) AS noaa20_count,
            coalesce(sum(frp) FILTER (WHERE sensor = 'MODIS'), 0) AS modis_frp_sum,
            coalesce(sum(frp) FILTER (WHERE satellite = 'SNPP'), 0) AS snpp_frp_sum,
            coalesce(sum(frp) FILTER (WHERE satellite = 'NOAA20'), 0) AS noaa20_frp_sum
        FROM clean
        GROUP BY cell_x, cell_y, year, month
        ORDER BY cell_x, cell_y, year, month
        """
    )


def report(con):
    print("Detections kept, by satellite:")
    for satellite, n, first, last in con.execute(
        "SELECT satellite, count(*), min(acq_date), max(acq_date) FROM clean GROUP BY 1 ORDER BY 1"
    ).fetchall():
        print(f"  {satellite:7s} {n:>12,d}   {first} to {last}")
    rows, cells = con.execute("SELECT count(*), count(DISTINCT (cell_x, cell_y)) FROM grid").fetchone()
    print(f"Grid: {rows:,d} rows over {cells:,d} cells")
    bad = con.execute("SELECT count(*) FROM grid WHERE harmonized_count IS NULL OR harmonized_count < 0").fetchone()[0]
    print(f"Rows with a missing or negative harmonized_count: {bad} (must be 0)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fixtures", action="store_true", help="build the small fake data set")
    args = parser.parse_args()

    raw_dir = config.FIXTURES_DIR / "raw" if args.fixtures else config.RAW_DIR
    out_dir = config.FIXTURES_DIR if args.fixtures else config.PROCESSED_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.fixtures:
        con = duckdb.connect()  # in memory
    else:
        config.INTERIM_DIR.mkdir(parents=True, exist_ok=True)
        con = duckdb.connect(str(config.INTERIM_DIR / "work.duckdb"))  # on disk, so big data fits

    print(f"Reading raw files from {raw_dir}")
    load_clean(con, raw_dir)
    write_points(con, out_dir)
    build_grid_counts(con)
    con.execute(f"COPY grid_counts TO '{(out_dir / 'grid_counts.parquet').as_posix()}' (FORMAT PARQUET)")

    data_through = con.execute("SELECT max(acq_date) FROM clean").fetchone()[0]
    harmonize.run(con, out_dir, str(data_through))  # creates the table "grid"
    con.execute(
        f"""
        COPY (SELECT * FROM grid ORDER BY cell_x, cell_y, year, month)
        TO '{(out_dir / 'grid.parquet').as_posix()}' (FORMAT PARQUET)
        """
    )
    report(con)
    print(f"Done. Tables are in {out_dir}")


if __name__ == "__main__":
    main()
```

### `pipeline/harmonize.py`

```python
"""Harmonization: put every month on the VIIRS Suomi NPP scale.

This is version v0, a placeholder so the rest of the app has numbers to show:
one VIIRS to MODIS ratio per country. Andrew L replaces the inside of run()
with the real method. The inputs and outputs of run() must not change.

Copied from MASTERSPEC.md Appendix A.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import config


def run(con, out_dir, data_through):
    """Read the table grid_counts in `con`, create the table grid, write harmonization.json.

    grid has every column of grid_counts plus harmonized_count (DOUBLE, never null, never negative).
    """
    con.execute(
        f"""
        CREATE OR REPLACE TABLE ratio_v0 AS
        SELECT country, sum(snpp_count) * 1.0 / nullif(sum(modis_count), 0) AS ratio
        FROM grid_counts
        WHERE year * 100 + month > {config.MODIS_ERA_END_YM}
          AND year * 100 + month <= {config.SNPP_ERA_END_YM}
        GROUP BY country
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE grid AS
        SELECT
            g.*,
            CAST(CASE
                WHEN g.year * 100 + g.month <= {config.MODIS_ERA_END_YM}
                    THEN g.modis_count * coalesce(r.ratio, 1.0)
                WHEN g.year * 100 + g.month <= {config.SNPP_ERA_END_YM}
                    THEN g.snpp_count
                ELSE g.noaa20_count * 1.0
            END AS DOUBLE) AS harmonized_count
        FROM grid_counts g
        LEFT JOIN ratio_v0 r ON r.country = g.country
        """
    )
    ratios = con.execute("SELECT country, ratio FROM ratio_v0 ORDER BY country").fetchall()
    summary = {
        "method": "v0",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_through": data_through,
        "reference": "VIIRS S-NPP 375 m",
        "handoff_ratio_noaa20": 1.0,
        "train_years": None,
        "test_years": None,
        "validation": None,
        "notes": "Placeholder. One VIIRS to MODIS ratio per country: "
        + ", ".join(f"{country} {ratio:.2f}" for country, ratio in ratios if ratio is not None),
    }
    (Path(out_dir) / "harmonization.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
```

### `backend/app/config.py`

```python
"""Backend settings and constants.

Copied from MASTERSPEC.md Appendix A. Change only with team agreement.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # the repo root

APP_NAME = "Pyronac"

# Months are compared as year * 100 + month. Same values as pipeline/config.py.
FIRST_YM = 200301
MODIS_ERA_END_YM = 201201
SNPP_ERA_END_YM = 202610

MAX_CSV_ROWS = 1_000_000


def data_dir() -> Path:
    """Real data if it has been built, otherwise the fake fixtures.

    Set FIRE_DATA_DIR to force a folder.
    """
    forced = os.environ.get("FIRE_DATA_DIR")
    if forced:
        return Path(forced)
    processed = ROOT / "data" / "processed"
    if (processed / "grid.parquet").exists():
        return processed
    return ROOT / "data" / "fixtures"


def data_source() -> str:
    return "fixtures" if data_dir().name == "fixtures" else "processed"


ERAS = [
    {"id": "modis", "label": "MODIS, scaled to match VIIRS", "from": "2003-01", "to": "2012-01"},
    {"id": "snpp", "label": "VIIRS on Suomi NPP, as observed", "from": "2012-02", "to": "2026-10"},
    {"id": "noaa20", "label": "VIIRS on NOAA-20, scaled to match Suomi NPP", "from": "2026-11", "to": None},
]

# /api/meta returns a preset only when its country is in the data.
PRESETS = [
    {"id": "nwt", "name": "Northwest Territories, Canada", "country": "canada",
     "bbox": {"west": -136.5, "south": 60.0, "east": -102.0, "north": 70.0}},
    {"id": "bc", "name": "British Columbia, Canada", "country": "canada",
     "bbox": {"west": -139.1, "south": 48.3, "east": -114.0, "north": 60.0}},
    {"id": "canada", "name": "All of Canada", "country": "canada",
     "bbox": {"west": -141.0, "south": 41.7, "east": -52.6, "north": 83.2}},
    {"id": "punjab", "name": "Punjab and Haryana, India", "country": "india",
     "bbox": {"west": 73.8, "south": 27.6, "east": 77.6, "north": 32.6}},
    {"id": "amazon", "name": "Southern Amazon, Brazil", "country": "brazil",
     "bbox": {"west": -66.0, "south": -13.5, "east": -48.0, "north": -2.0}},
]
# Shown only while the backend is running on fixtures.
FIXTURE_PRESET = {"id": "fixture", "name": "Test box near Yellowknife", "country": "canada",
                  "bbox": {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0}}


def era_of(year: int, month: int) -> str:
    ym = year * 100 + month
    if ym <= MODIS_ERA_END_YM:
        return "modis"
    if ym <= SNPP_ERA_END_YM:
        return "snpp"
    return "noaa20"
```

### `backend/app/db.py`

```python
"""One read-only DuckDB connection over the Parquet files.

Every router gets its data through query() or stream(). Do not open other connections.
Copied from MASTERSPEC.md Appendix A. Change only with team agreement.

Two views are available to SQL:

grid    one row per 0.1 degree cell and month. Columns:
        cell_x, cell_y, year, month, country,
        modis_count, snpp_count, noaa20_count,
        modis_frp_sum, snpp_frp_sum, noaa20_frp_sum,
        harmonized_count,
        ym           year * 100 + month
        raw_count    what a naive user would count: MODIS, then S-NPP, then NOAA-20
        viirs_count  the VIIRS count of that era, NULL before 2012-02

points  one row per detection. Columns:
        latitude, longitude, acq_date, acq_time, sensor, satellite, confidence,
        frp, daynight, country, cell_x, cell_y, year, month
"""
import json
import threading

import duckdb

from . import config

_lock = threading.Lock()
_con = None


def _connect():
    folder = config.data_dir().as_posix()
    con = duckdb.connect()
    con.execute(
        f"""
        CREATE VIEW grid AS
        SELECT
            *,
            year * 100 + month AS ym,
            CASE
                WHEN year * 100 + month <= {config.MODIS_ERA_END_YM} THEN modis_count
                WHEN year * 100 + month <= {config.SNPP_ERA_END_YM} THEN snpp_count
                ELSE noaa20_count
            END AS raw_count,
            CASE
                WHEN year * 100 + month <= {config.MODIS_ERA_END_YM} THEN NULL
                WHEN year * 100 + month <= {config.SNPP_ERA_END_YM} THEN snpp_count
                ELSE noaa20_count
            END AS viirs_count
        FROM read_parquet('{folder}/grid.parquet')
        """
    )
    con.execute(
        f"""
        CREATE VIEW points AS
        SELECT * FROM read_parquet('{folder}/points/*/*.parquet', hive_partitioning = true)
        """
    )
    return con


def _connection():
    global _con
    if _con is None:
        _con = _connect()
    return _con


def query(sql, params=None):
    """Run a query and return a list of dicts, one per row.

    Use ? placeholders and pass values in params. Never build SQL from user input.
    """
    with _lock:
        result = _connection().execute(sql, params or [])
        names = [column[0] for column in result.description]
        return [dict(zip(names, row)) for row in result.fetchall()]


def stream(sql, params=None, batch=50_000):
    """Yield rows as tuples, a batch at a time. For big CSV exports."""
    with _lock:
        cursor = _connection().cursor()
    cursor.execute(sql, params or [])
    while True:
        rows = cursor.fetchmany(batch)
        if not rows:
            break
        yield from rows


def harmonization():
    """The contents of harmonization.json, written by the pipeline."""
    return json.loads((config.data_dir() / "harmonization.json").read_text(encoding="utf-8"))
```

### `backend/app/deps.py`

```python
"""The area box that every endpoint takes.

Copied from MASTERSPEC.md Appendix A. Change only with team agreement.

Use it like this:

    from fastapi import Depends
    from ..deps import Bbox, bbox_params

    @router.get("/something")
    def something(bbox: Bbox = Depends(bbox_params)):
        rows = db.query(
            "SELECT ... FROM grid WHERE cell_x BETWEEN ? AND ? AND cell_y BETWEEN ? AND ?",
            [bbox.x0, bbox.x1, bbox.y0, bbox.y1],
        )
        return {"bbox": bbox.as_dict(), ...}
"""
import math
from dataclasses import dataclass

from fastapi import HTTPException, Query


@dataclass(frozen=True)
class Bbox:
    # The box after snapping outward to the 0.1 degree grid, in degrees.
    west: float
    south: float
    east: float
    north: float
    # The same box as cell indexes, both ends included.
    x0: int
    x1: int
    y0: int
    y1: int

    def as_dict(self):
        return {"west": self.west, "south": self.south, "east": self.east, "north": self.north}


def bbox_params(
    west: float = Query(..., ge=-180, le=180, description="Western edge, degrees"),
    south: float = Query(..., ge=-90, le=90, description="Southern edge, degrees"),
    east: float = Query(..., ge=-180, le=180, description="Eastern edge, degrees"),
    north: float = Query(..., ge=-90, le=90, description="Northern edge, degrees"),
) -> Bbox:
    if not (west < east and south < north):
        raise HTTPException(status_code=400, detail="Invalid box: need west < east and south < north.")
    # round() first so that -114.4 * 10 is -1144 and not -1144.0000000000002
    x0 = math.floor(round(west * 10, 6))
    x1 = math.ceil(round(east * 10, 6)) - 1
    y0 = math.floor(round(south * 10, 6))
    y1 = math.ceil(round(north * 10, 6)) - 1
    return Bbox(
        west=x0 / 10, south=y0 / 10, east=(x1 + 1) / 10, north=(y1 + 1) / 10,
        x0=x0, x1=x1, y0=y0, y1=y1,
    )
```

### `backend/app/main.py`

```python
"""The FastAPI app. Run from the backend folder:  uvicorn app.main:app --reload --port 8000

Copied from MASTERSPEC.md Appendix A. To add an endpoint, add a file in app/routers
that defines `router = APIRouter()`. Do not edit this file to do it.
"""
import importlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Pyronac API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Each router file is picked up when it exists, so two people can add routers without
# touching the same file.
for name in ("meta", "calendar", "grid", "export", "compare", "trend", "anomaly"):
    try:
        module = importlib.import_module(f"app.routers.{name}")
    except ModuleNotFoundError as error:
        if error.name != f"app.routers.{name}":
            raise  # a real missing dependency inside the router: show it
        continue
    app.include_router(module.router, prefix="/api")
```

### `backend/pytest.ini`

```text
[pytest]
pythonpath = .
testpaths = tests
```

### `backend/tests/conftest.py`

```python
"""Tests always run on the fake fixtures. Copied from MASTERSPEC.md Appendix A."""
import os
from pathlib import Path

import pytest

os.environ["FIRE_DATA_DIR"] = str(Path(__file__).resolve().parents[2] / "data" / "fixtures")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

# The fixture box: every fake detection is inside it.
BOX = {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0}


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def box():
    return dict(BOX)
```

### `frontend/src/api/types.ts`

```ts
// Shared API types. Copied from MASTERSPEC.md Appendix A. Change only with team agreement.

export type Bbox = { west: number; south: number; east: number; north: number };
export type Era = "modis" | "snpp" | "noaa20";
export type Mode = "harmonized" | "raw";
export type SensorFilter = "all" | "modis" | "viirs";
export type YearMonth = { year: number; month: number };

export type Preset = { id: string; name: string; bbox: Bbox };

export type Harmonization = {
  method: "v0" | "ratio" | "ml";
  generated_at: string; // ISO time, UTC
  data_through: string; // "2026-11-06"
  reference: string; // "VIIRS S-NPP 375 m"
  handoff_ratio_noaa20: number;
  train_years: [number, number] | null;
  test_years: [number, number] | null;
  validation: { metric: string; raw_error: number; harmonized_error: number } | null;
  notes: string;
};

export type MetaResponse = {
  app: string;
  data_source: "fixtures" | "processed";
  first_month: string; // "2003-01"
  last_month: string; // latest month with any data, for example "2026-11"
  last_complete_month: string; // for example "2026-10"
  data_through: string; // "2026-11-06"
  countries: string[];
  presets: Preset[];
  eras: { id: Era; label: string; from: string; to: string | null }[];
  harmonization: Harmonization;
};

export type CalendarMonth = {
  year: number;
  month: number; // 1 to 12
  harmonized: number;
  raw: number;
  modis: number;
  viirs: number | null; // null before 2012-02
  era: Era;
  complete: boolean;
};

export type CalendarResponse = {
  bbox: Bbox;
  start_year: number;
  end_year: number;
  months: CalendarMonth[];
  max_harmonized: number;
  max_raw: number;
};

export type CompareLabel =
  | "well above normal"
  | "above normal"
  | "near normal"
  | "below normal"
  | "well below normal";

export type CompareResponse = {
  bbox: Bbox;
  target: { year: number; month: number; harmonized: number; complete: boolean; days_covered: number };
  baseline: {
    start_year: number;
    end_year: number;
    n_years: number;
    median: number;
    p25: number;
    p75: number;
    min: number;
    max: number;
  };
  difference: {
    absolute: number;
    percent: number | null; // null when the median is 0
    rank: number; // 1 is the highest
    of: number;
    percentile: number; // 0 to 100
    label: CompareLabel;
  };
  history: { year: number; harmonized: number }[];
};

// cells are [x, y, harmonized]. A cell covers longitude x*step/10 to (x+1)*step/10
// and latitude y*step/10 to (y+1)*step/10.
export type GridResponse = {
  bbox: Bbox;
  start: string; // "2023-06"
  end: string; // "2023-08"
  step: number; // 1, 5 or 10
  cells: [number, number, number][];
  max: number;
};

export type TrendFit = {
  slope_per_year: number;
  percent_per_decade: number | null;
  p_value: number;
  direction: "increasing" | "decreasing" | "no clear trend";
};

export type TrendResponse = {
  bbox: Bbox;
  start_year: number;
  end_year: number;
  years: { year: number; harmonized: number; raw: number; season_center: number | null }[];
  harmonized_trend: TrendFit;
  raw_trend: TrendFit;
  season_shift: { days_per_decade: number; p_value: number } | null;
};

// cells are [x, y, harmonized, median, percentile], same cell geometry as GridResponse.
export type AnomalyResponse = {
  bbox: Bbox;
  year: number;
  month: number;
  step: number;
  cells: [number, number, number, number, number][];
};

export type PointsCount = { count: number };
```

### `frontend/src/api/mock.ts`

```ts
// Fake API answers so the frontend works before the backend exists.
// Copied from MASTERSPEC.md Appendix A. The numbers are invented but have the right shape.
import type {
  AnomalyResponse,
  Bbox,
  CalendarMonth,
  CalendarResponse,
  CompareLabel,
  CompareResponse,
  Era,
  GridResponse,
  MetaResponse,
  PointsCount,
  TrendFit,
  TrendResponse,
} from "./types";

const SEASON = [0, 0, 0.02, 0.2, 1, 2.5, 4, 3, 1, 0.2, 0.05, 0];
const BIG_YEARS: Record<number, number> = { 2004: 2, 2014: 3, 2017: 1.8, 2023: 5 };
const VIIRS_PER_MODIS = 4.5;
const LAST = { year: 2026, month: 11, day: 6 };

function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function eraOf(year: number, month: number): Era {
  const ym = year * 100 + month;
  if (ym <= 201201) return "modis";
  if (ym <= 202610) return "snpp";
  return "noaa20";
}

function snap(b: Bbox): Bbox {
  return {
    west: Math.floor(b.west * 10) / 10,
    south: Math.floor(b.south * 10) / 10,
    east: Math.ceil(b.east * 10) / 10,
    north: Math.ceil(b.north * 10) / 10,
  };
}

function monthRow(b: Bbox, year: number, month: number): CalendarMonth {
  const area = Math.max(0.01, (b.east - b.west) * (b.north - b.south));
  const base = 12 * area * SEASON[month - 1] * (BIG_YEARS[year] ?? 1) * (0.6 + 0.8 * noise(year * 13 + month));
  const era = eraOf(year, month);
  const modis = Math.round(base);
  const viirs = era === "modis" ? null : Math.round(base * VIIRS_PER_MODIS);
  return {
    year,
    month,
    harmonized: viirs ?? Math.round(modis * VIIRS_PER_MODIS * 10) / 10,
    raw: viirs ?? modis,
    modis,
    viirs,
    era,
    complete: !(year === LAST.year && month === LAST.month),
  };
}

function monthsFor(b: Bbox, startYear: number, endYear: number): CalendarMonth[] {
  const rows: CalendarMonth[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year * 100 + month > LAST.year * 100 + LAST.month) break;
      rows.push(monthRow(b, year, month));
    }
  }
  return rows;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function labelFor(percentile: number): CompareLabel {
  if (percentile >= 90) return "well above normal";
  if (percentile >= 75) return "above normal";
  if (percentile > 25) return "near normal";
  if (percentile > 10) return "below normal";
  return "well below normal";
}

function fit(values: number[]): TrendFit {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, v) => a + v, 0) / Math.max(1, n);
  let top = 0;
  let bottom = 0;
  values.forEach((v, i) => {
    top += (i - meanX) * (v - meanY);
    bottom += (i - meanX) ** 2;
  });
  const slope = bottom === 0 ? 0 : top / bottom;
  return {
    slope_per_year: Math.round(slope * 10) / 10,
    percent_per_decade: meanY === 0 ? null : Math.round(((slope * 10) / meanY) * 1000) / 10,
    p_value: 0.2,
    direction: "no clear trend",
  };
}

export const mock = {
  meta(): MetaResponse {
    return {
      app: "Pyronac",
      data_source: "fixtures",
      first_month: "2003-01",
      last_month: "2026-11",
      last_complete_month: "2026-10",
      data_through: "2026-11-06",
      countries: ["canada"],
      presets: [
        { id: "fixture", name: "Test box near Yellowknife", bbox: { west: -116, south: 61, east: -114, north: 63 } },
        { id: "nwt", name: "Northwest Territories, Canada", bbox: { west: -136.5, south: 60, east: -102, north: 70 } },
      ],
      eras: [
        { id: "modis", label: "MODIS, scaled to match VIIRS", from: "2003-01", to: "2012-01" },
        { id: "snpp", label: "VIIRS on Suomi NPP, as observed", from: "2012-02", to: "2026-10" },
        { id: "noaa20", label: "VIIRS on NOAA-20, scaled to match Suomi NPP", from: "2026-11", to: null },
      ],
      harmonization: {
        method: "v0",
        generated_at: "2026-11-14T13:00:00Z",
        data_through: "2026-11-06",
        reference: "VIIRS S-NPP 375 m",
        handoff_ratio_noaa20: 1,
        train_years: null,
        test_years: null,
        validation: null,
        notes: "Mock data.",
      },
    };
  },

  calendar(bbox: Bbox, startYear = 2003, endYear = 2026): CalendarResponse {
    const b = snap(bbox);
    const months = monthsFor(b, startYear, endYear);
    return {
      bbox: b,
      start_year: startYear,
      end_year: endYear,
      months,
      max_harmonized: Math.max(0, ...months.map((m) => m.harmonized)),
      max_raw: Math.max(0, ...months.map((m) => m.raw)),
    };
  },

  compare(bbox: Bbox, year = 2026, month = 10, baselineStart = 2003, baselineEnd = 2025): CompareResponse {
    const b = snap(bbox);
    const target = monthRow(b, year, month);
    const history: { year: number; harmonized: number }[] = [];
    for (let y = baselineStart; y <= baselineEnd; y++) {
      if (y !== year) history.push({ year: y, harmonized: monthRow(b, y, month).harmonized });
    }
    const sorted = history.map((h) => h.harmonized).sort((a, c) => a - c);
    const median = quantile(sorted, 0.5);
    const below = sorted.filter((v) => v < target.harmonized).length;
    const percentile = sorted.length === 0 ? 0 : Math.round((1000 * below) / sorted.length) / 10;
    return {
      bbox: b,
      target: {
        year,
        month,
        harmonized: target.harmonized,
        complete: target.complete,
        days_covered: target.complete ? new Date(year, month, 0).getDate() : LAST.day,
      },
      baseline: {
        start_year: baselineStart,
        end_year: baselineEnd,
        n_years: sorted.length,
        median,
        p25: quantile(sorted, 0.25),
        p75: quantile(sorted, 0.75),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      },
      difference: {
        absolute: Math.round((target.harmonized - median) * 10) / 10,
        percent: median === 0 ? null : Math.round(((target.harmonized - median) / median) * 1000) / 10,
        rank: sorted.filter((v) => v > target.harmonized).length + 1,
        of: sorted.length + 1,
        percentile,
        label: target.harmonized === median ? "near normal" : labelFor(percentile),
      },
      history,
    };
  },

  grid(bbox: Bbox, start = "2023-07", end = "2023-07", step = 1): GridResponse {
    const b = snap(bbox);
    const cells: [number, number, number][] = [];
    const x0 = Math.round((b.west * 10) / step);
    const x1 = Math.round((b.east * 10) / step);
    const y0 = Math.round((b.south * 10) / step);
    const y1 = Math.round((b.north * 10) / step);
    const stride = Math.max(1, Math.ceil(((x1 - x0) * (y1 - y0)) / 4000));
    let index = 0;
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        index++;
        if (index % stride !== 0) continue;
        const n = noise(x * 7.1 + y * 3.3);
        if (n > 0.35) continue;
        cells.push([x, y, Math.round(1 + 400 * n * n * 8)]);
      }
    }
    return { bbox: b, start, end, step, cells, max: Math.max(0, ...cells.map((c) => c[2])) };
  },

  trend(bbox: Bbox, startYear = 2003, endYear = 2025): TrendResponse {
    const b = snap(bbox);
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      const rows = monthsFor(b, year, year);
      const harmonized = rows.reduce((a, m) => a + m.harmonized, 0);
      const raw = rows.reduce((a, m) => a + m.raw, 0);
      const weighted = rows.reduce((a, m) => a + m.month * m.harmonized, 0);
      years.push({
        year,
        harmonized: Math.round(harmonized * 10) / 10,
        raw,
        season_center: harmonized === 0 ? null : Math.round((weighted / harmonized) * 100) / 100,
      });
    }
    return {
      bbox: b,
      start_year: startYear,
      end_year: endYear,
      years,
      harmonized_trend: fit(years.map((y) => y.harmonized)),
      raw_trend: { ...fit(years.map((y) => y.raw)), p_value: 0.001, direction: "increasing" },
      season_shift: { days_per_decade: -2.1, p_value: 0.4 },
    };
  },

  anomaly(bbox: Bbox, year = 2023, month = 7, step = 1): AnomalyResponse {
    const g = mock.grid(bbox, "2023-07", "2023-07", step);
    return {
      bbox: g.bbox,
      year,
      month,
      step,
      cells: g.cells.map(([x, y, v]) => {
        const median = Math.round(v * (0.2 + noise(x + y * 1.7)));
        return [x, y, v, median, Math.round(100 * noise(x * 1.3 + y))];
      }),
    };
  },

  pointsCount(): PointsCount {
    return { count: 12431 };
  },
};
```

### `frontend/src/api/client.ts`

```ts
// The only place the frontend talks to the backend.
// Copied from MASTERSPEC.md Appendix A. Change only with team agreement.
import { mock } from "./mock";
import type {
  AnomalyResponse,
  Bbox,
  CalendarResponse,
  CompareResponse,
  GridResponse,
  MetaResponse,
  PointsCount,
  SensorFilter,
  TrendResponse,
} from "./types";

const BASE: string = import.meta.env.VITE_API_BASE ?? "";
const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === "1";

type Params = Record<string, string | number | undefined>;

function query(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}

function url(path: string, params: Params): string {
  const q = query(params);
  return q ? `${BASE}${path}?${q}` : `${BASE}${path}`;
}

async function get<T>(path: string, params: Params = {}): Promise<T> {
  const response = await fetch(url(path, params));
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export const api = {
  meta: (): Promise<MetaResponse> => (USE_MOCKS ? Promise.resolve(mock.meta()) : get("/api/meta")),

  calendar: (bbox: Bbox, startYear: number, endYear: number): Promise<CalendarResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.calendar(bbox, startYear, endYear))
      : get("/api/calendar", { ...bbox, start_year: startYear, end_year: endYear }),

  // Leave year and month out to get the latest complete month.
  compare: (
    bbox: Bbox,
    year?: number,
    month?: number,
    baselineStart?: number,
    baselineEnd?: number,
  ): Promise<CompareResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.compare(bbox, year, month, baselineStart, baselineEnd))
      : get("/api/compare", { ...bbox, year, month, baseline_start: baselineStart, baseline_end: baselineEnd }),

  // start and end are "YYYY-MM", both included. Leave step out and the backend picks one.
  grid: (bbox: Bbox, start: string, end: string, step?: number): Promise<GridResponse> =>
    USE_MOCKS ? Promise.resolve(mock.grid(bbox, start, end, step)) : get("/api/grid", { ...bbox, start, end, step }),

  trend: (bbox: Bbox, startYear?: number, endYear?: number): Promise<TrendResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.trend(bbox, startYear, endYear))
      : get("/api/trend", { ...bbox, start_year: startYear, end_year: endYear }),

  anomaly: (bbox: Bbox, year: number, month: number, step?: number): Promise<AnomalyResponse> =>
    USE_MOCKS
      ? Promise.resolve(mock.anomaly(bbox, year, month, step))
      : get("/api/anomaly", { ...bbox, year, month, step }),

  // start and end are "YYYY-MM-DD", both included.
  pointsCount: (bbox: Bbox, start: string, end: string, sensor: SensorFilter = "all"): Promise<PointsCount> =>
    USE_MOCKS ? Promise.resolve(mock.pointsCount()) : get("/api/points/count", { ...bbox, start, end, sensor }),

  // Links for <a href download>. With mocks on they point at the real backend and will not work.
  pointsCsvUrl: (bbox: Bbox, start: string, end: string, sensor: SensorFilter = "all"): string =>
    url("/api/points.csv", { ...bbox, start, end, sensor }),

  calendarCsvUrl: (bbox: Bbox, startYear: number, endYear: number): string =>
    url("/api/calendar.csv", { ...bbox, start_year: startYear, end_year: endYear }),
};
```

### `frontend/src/state/store.ts`

```ts
// The one shared piece of UI state. Copied from MASTERSPEC.md Appendix A.
// Change only with team agreement.
import { create } from "zustand";
import type { Bbox, Mode, YearMonth } from "../api/types";

export type Ramp = "fire" | "cividis";

type State = {
  bbox: Bbox | null; // the selected area, null until the user picks one
  startYear: number;
  endYear: number;
  mode: Mode; // "harmonized" or "raw"
  selected: YearMonth | null; // the month clicked in the calendar
  ramp: Ramp; // colour ramp, "cividis" is the colour-blind option
  setBbox: (bbox: Bbox | null) => void;
  setYears: (startYear: number, endYear: number) => void;
  setMode: (mode: Mode) => void;
  setSelected: (selected: YearMonth | null) => void;
  setRamp: (ramp: Ramp) => void;
};

export const useStore = create<State>()((set) => ({
  bbox: null,
  startYear: 2003,
  endYear: 2026,
  mode: "harmonized",
  selected: null,
  ramp: "fire",
  setBbox: (bbox) => set({ bbox }),
  setYears: (startYear, endYear) => set({ startYear, endYear }),
  setMode: (mode) => set({ mode }),
  setSelected: (selected) => set({ selected }),
  setRamp: (ramp) => set({ ramp }),
}));
```
