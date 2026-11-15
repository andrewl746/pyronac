# Pyronac, a fire record to plan with

NASA FIRMS MODIS and VIIRS fire history for Canada, India and Brazil, 2003 to this month,
harmonized to the Suomi NPP VIIRS scale. NASA Space Apps Challenge 2026, Toronto.

Read [MASTERSPEC.md](MASTERSPEC.md) for the project contracts and team task sheets.

## Get the data

Real data is not in git. Download the processed tables from the
[per-country data release](https://github.com/andrewl746/pyronac/releases/tag/data-3-countries-2003-2026-per-country-20261114)
(raw FIRMS CSVs are on the [earlier release](https://github.com/andrewl746/pyronac/releases/tag/data-canada-2003-2025-20261114)) and see [docs/DATA_NOTES.md](docs/DATA_NOTES.md) for which file to take.
The backend and its tests run on the small fake set in `data/fixtures/` without any download.

## Build the tables yourself

Use Python 3.11 or newer:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
python pipeline/make_fixtures.py
python pipeline/build.py --fixtures          # fake data -> data/fixtures/
python pipeline/download.py --country canada --years 2003-2025 --sources modis,viirs-snpp
python pipeline/download.py --country canada --years 2018-2025 --sources viirs-jpss1
python pipeline/build.py                     # real data -> data/processed/
```

Downloads skip files that already exist and are not empty. An interrupted download is left as a
`.part` file and never looks complete. The 2026 files need a signed-in FIRMS archive request:
see section 5.1 of the master spec. Check the downloader with
`cd pipeline && python -m unittest test_download`.

## AI use

AI assistance and how it was checked is recorded in [docs/AI_USE.md](docs/AI_USE.md).
