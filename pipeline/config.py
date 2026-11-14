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
