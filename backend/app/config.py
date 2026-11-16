"""Backend settings and constants."""
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
