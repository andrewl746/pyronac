# Data notes (Yuvi)

Status: Saturday 14 November 2026, 18:10 UTC.

## Get the data: no NASA login needed

All files are on the public release
[data-canada-2003-2025-20261114](https://github.com/andrewl746/pyronac/releases/tag/data-canada-2003-2025-20261114).
Checksums are in [SHA256SUMS.txt](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/SHA256SUMS.txt).

| File | What it is | Size |
|---|---|---:|
| **[pyronac-canada-india-brazil-processed-ml-2003-2026.zip](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-canada-india-brazil-processed-ml-2003-2026.zip)** | **Use this one.** Canada, India and Brazil, 2003 to 14 Nov 2026, built with `main`'s harmonizer (method `ml`) | 698 MB |
| [pyronac-canada-india-brazil-processed-2003-2026.zip](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-canada-india-brazil-processed-2003-2026.zip) | Same data, older build with the Appendix A v0 placeholder | 695 MB |
| [pyronac-canada-2003-2025.zip](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-canada-2003-2025.zip) | First Canada-only build, through 2025, v0 | 100 MB |
| [pyronac-canada-raw-2003-2026.zip](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-canada-raw-2003-2026.zip) | Raw FIRMS CSVs, Canada | 287 MB |
| [pyronac-india-raw-2003-2026.zip](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-india-raw-2003-2026.zip) | Raw FIRMS CSVs, India | 352 MB |
| [pyronac-brazil-raw-2003-2026.zip](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-brazil-raw-2003-2026.zip) | Raw FIRMS CSVs, Brazil | 910 MB |

Processed ZIPs: extract into `data/processed/`. They hold `points/year=YYYY/*.parquet`,
`grid_counts.parquet`, `grid.parquet` and `harmonization.json`.
Raw ZIPs: extract into `data/raw/` and run `python pipeline/build.py` to rebuild with your own code.

## What is in it

| | |
|---|---|
| Sources | NASA FIRMS MODIS Collection 6.1 (Terra, Aqua); VIIRS 375 m on Suomi NPP and NOAA-20 |
| Countries | Canada, India, Brazil |
| Raw files | 153 CSVs, 51 per country: MODIS 2003–2025 (23), Suomi NPP 2012–2025 (14), NOAA-20 2018–2025 (8), and six 2026 files (archive and NRT for each sensor) |
| Raw bytes | Canada 1,111,374,908; India 1,246,536,237; Brazil 3,289,993,079 |
| `data_through` | 2026-11-14 |
| Served points | 42,769,559 (Brazil 26,866,806; India 8,078,063; Canada 7,824,690) |
| Grid | 4,944,893 rows over 142,277 cells |
| Harmonization | `ml`, validation: raw error 0.7769 → harmonized 0.1062 (median absolute percentage error of monthly totals per country, 2020–2025, learned on 2012–2019) |
| NOAA-20 handoff ratios | Brazil 1.011, Canada 0.997, India 0.987 |

Yearly files come from `https://firms.modaps.eosdis.nasa.gov/data/country/<source>/<year>/<source>_<year>_<Country>.csv`
(`pipeline/download.py`). The 2026 files came from signed-in FIRMS archive requests by country
(2026-01-01 to 2026-11-14), saved as `<source>_2026-archive_<Country>.csv` and
`<source>_2026-nrt_<Country>.csv` per section 5.1. Some yearly files failed the first time in the
browser and were downloaded again before the build. No expected country, sensor or year is missing.

## Checks (section 12), on the ML build

| Check | Result |
|---|---|
| D1 `build.py --fixtures` | passes |
| D2 duplicate cell-months | 0 |
| D3 null or negative counts | 0 |
| D4 Suomi NPP before 2012-01 / NOAA-20 before 2018-04 | 0 |
| D5 snpp era where harmonized ≠ snpp | 0 |
| D6 months where points ≠ grid sums | 0 |
| Step 4 | `data_through` 2026-11-14, Suomi NPP last date 2026-11-02, NOAA-20 has November 2026 rows |

## Things to know

- **The full build needs PR #28.** On `main` as of this note, `build.py` runs out of disk on all three
  countries (DuckDB spilled 227 GiB) in two joins in `ml_model.py`. PR #28 fixes both without changing any
  value. The ML ZIP above was built with it in 67 s. Canada alone is much smaller, which is likely why this was not seen earlier.
- `points` serves only the sensor of each era: MODIS before Feb 2012, Suomi NPP to Oct 2026, NOAA-20
  from Nov 2026. Historical NOAA-20 and Suomi NPP's partial January 2012 are in `grid_counts` only.
- Suomi NPP stops on 2026-11-02. That is why the record switches to NOAA-20 in November 2026.
- The MODIS CSVs carry version labels `6.03`, `61.03` and `6.2`; VIIRS carries `2`. Left unchanged.
- Busiest Suomi NPP year: Canada 2023 (1,641,678), India 2021, Brazil 2024.

## Detections kept after cleaning, per year and satellite
['latitude', 'longitude', 'acq_date', 'acq_time', 'sensor', 'satellite', 'confidence', 'frp', 'daynight', 'country', 'cell_x', 'cell_y', 'year', 'month']

### Canada

| Year | Terra | Aqua | Suomi NPP | NOAA-20 |
|---|---:|---:|---:|---:|
| 2003 | 22,502 | 23,253 | 0 | 0 |
| 2004 | 36,434 | 30,439 | 0 | 0 |
| 2005 | 14,910 | 14,188 | 0 | 0 |
| 2006 | 15,531 | 15,268 | 0 | 0 |
| 2007 | 14,648 | 14,612 | 0 | 0 |
| 2008 | 13,374 | 13,227 | 0 | 0 |
| 2009 | 13,111 | 12,703 | 0 | 0 |
| 2010 | 23,665 | 21,258 | 0 | 0 |
| 2011 | 17,634 | 15,590 | 0 | 0 |
| 2012 | 18,205 | 16,534 | 170,046 | 0 |
| 2013 | 29,550 | 26,684 | 311,138 | 0 |
| 2014 | 34,595 | 27,812 | 460,528 | 0 |
| 2015 | 33,971 | 30,901 | 301,445 | 0 |
| 2016 | 12,235 | 11,290 | 101,567 | 0 |
| 2017 | 43,775 | 37,366 | 426,242 | 0 |
| 2018 | 29,804 | 26,991 | 302,827 | 292,363 |
| 2019 | 19,832 | 15,854 | 170,859 | 176,184 |
| 2020 | 5,340 | 5,693 | 37,262 | 37,667 |
| 2021 | 45,071 | 38,221 | 430,732 | 432,332 |
| 2022 | 15,042 | 14,295 | 151,415 | 156,884 |
| 2023 | 148,663 | 131,826 | 1,641,678 | 1,570,722 |
| 2024 | 65,158 | 62,762 | 669,543 | 741,978 |
| 2025 | 69,340 | 63,437 | 841,557 | 850,021 |
| 2026 | 30,280 | 33,352 | 329,362 | 441,023 |

### India

| Year | Terra | Aqua | Suomi NPP | NOAA-20 |
|---|---:|---:|---:|---:|
| 2003 | 14,247 | 38,822 | 0 | 0 |
| 2004 | 14,483 | 46,304 | 0 | 0 |
| 2005 | 14,385 | 45,430 | 0 | 0 |
| 2006 | 15,798 | 45,910 | 0 | 0 |
| 2007 | 19,518 | 51,109 | 0 | 0 |
| 2008 | 20,179 | 46,685 | 0 | 0 |
| 2009 | 23,764 | 61,366 | 0 | 0 |
| 2010 | 18,427 | 52,742 | 0 | 0 |
| 2011 | 19,447 | 48,123 | 0 | 0 |
| 2012 | 25,013 | 62,835 | 447,660 | 0 |
| 2013 | 18,062 | 48,088 | 359,046 | 0 |
| 2014 | 19,710 | 50,365 | 399,283 | 0 |
| 2015 | 17,069 | 45,348 | 350,518 | 0 |
| 2016 | 22,028 | 60,529 | 508,362 | 0 |
| 2017 | 21,658 | 54,281 | 434,728 | 0 |
| 2018 | 23,912 | 58,112 | 469,137 | 237,198 |
| 2019 | 22,220 | 45,772 | 377,506 | 372,999 |
| 2020 | 19,909 | 48,705 | 353,198 | 353,810 |
| 2021 | 29,297 | 73,316 | 581,605 | 578,772 |
| 2022 | 23,755 | 50,492 | 423,190 | 436,600 |
| 2023 | 20,987 | 49,748 | 409,396 | 417,646 |
| 2024 | 20,450 | 45,796 | 382,884 | 401,303 |
| 2025 | 24,899 | 60,764 | 459,815 | 465,254 |
| 2026 | 24,442 | 48,573 | 378,794 | 428,055 |

### Brazil

| Year | Terra | Aqua | Suomi NPP | NOAA-20 |
|---|---:|---:|---:|---:|
| 2003 | 156,303 | 351,617 | 0 | 0 |
| 2004 | 187,404 | 391,756 | 0 | 0 |
| 2005 | 207,379 | 386,960 | 0 | 0 |
| 2006 | 123,951 | 259,815 | 0 | 0 |
| 2007 | 238,701 | 423,351 | 0 | 0 |
| 2008 | 115,002 | 222,111 | 0 | 0 |
| 2009 | 77,499 | 159,811 | 0 | 0 |
| 2010 | 205,135 | 348,256 | 0 | 0 |
| 2011 | 91,107 | 166,256 | 0 | 0 |
| 2012 | 147,941 | 232,761 | 1,450,651 | 0 |
| 2013 | 75,865 | 132,225 | 775,066 | 0 |
| 2014 | 109,126 | 184,353 | 1,115,517 | 0 |
| 2015 | 159,924 | 235,864 | 1,540,019 | 0 |
| 2016 | 119,330 | 194,824 | 1,173,145 | 0 |
| 2017 | 144,130 | 222,853 | 1,387,597 | 0 |
| 2018 | 78,479 | 135,306 | 820,547 | 757,632 |
| 2019 | 139,070 | 210,961 | 1,315,927 | 1,283,440 |
| 2020 | 156,912 | 221,031 | 1,503,981 | 1,462,966 |
| 2021 | 124,843 | 193,498 | 1,207,093 | 1,174,506 |
| 2022 | 125,510 | 213,647 | 1,272,980 | 1,311,891 |
| 2023 | 134,297 | 200,182 | 1,210,716 | 1,170,617 |
| 2024 | 193,310 | 299,599 | 1,767,650 | 1,801,886 |
| 2025 | 81,436 | 140,750 | 762,985 | 748,387 |
| 2026 | 70,788 | 117,303 | 605,648 | 652,269 |
