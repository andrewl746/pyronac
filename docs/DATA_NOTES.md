# Data handoff — Yuvi

## Download available now

[Download Canada processed data, 2003–2025 (99.8 MB)](https://github.com/andrewl746/pyronac/releases/download/data-canada-2003-2025-20261114/pyronac-canada-2003-2025.zip).

[Public release page](https://github.com/andrewl746/pyronac/releases/tag/data-canada-2003-2025-20261114).

Extract the ZIP contents into `data/processed/` in your checkout. It includes `points/year=YYYY/*.parquet`, `grid_counts.parquet`, `grid.parquet`, and `harmonization.json`. No NASA login is needed for this GitHub download.

The snapshot contains 7,429,034 served detections and 258,833 cell/month rows, through 2025-12-31. Data checks D1–D6 and ZIP integrity checks passed. SHA-256: `c37f6dabbb32f96a9b36578f21b8ca73d357b0605640324beda5696eb4580709`.

This snapshot uses the Appendix A **v0 placeholder**, with a Canada ratio approximately 5.57. It does not use Andrew’s newer harmonization method; rebuild the raw data with current pipeline code to apply that method.

## Complete dataset prepared locally

All **153 raw CSVs** for Canada, India and Brazil are downloaded, including 45 yearly files per country and six separate archive/NRT files per country for 2026. Sources are NASA FIRMS MODIS, Suomi NPP VIIRS and NOAA-20 VIIRS.

The combined build runs through **2026-11-14**, with **42,769,559 served detections** and **4,944,893 grid rows**. D2–D6 pass with zero violations. No expected instrument/year is missing. Suomi NPP ends on 2026-11-02; NOAA-20 has November rows in all three countries. Fixture build D1 also passed.

Verified archives for the full dataset are ready locally; their public uploads are still in progress. The Canada link above is already public and usable. Real data stays out of git history, per MASTERSPEC.md; release assets carry the large files.
