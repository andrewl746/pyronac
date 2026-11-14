"""GET /api/meta: what data is loaded and how it was harmonized. MASTERSPEC section 7."""
from fastapi import APIRouter

from .. import config, db, periods

router = APIRouter()


@router.get("/meta")
def meta():
    source = config.data_source()
    countries = [
        row["country"]
        for row in db.query("SELECT DISTINCT country FROM grid WHERE country IS NOT NULL ORDER BY country")
    ]
    presets = [preset for preset in config.PRESETS if preset["country"] in countries]
    if source == "fixtures":
        presets.insert(0, config.FIXTURE_PRESET)
    return {
        "app": config.APP_NAME,
        "data_source": source,
        "first_month": periods.month_string(config.FIRST_YM // 100, config.FIRST_YM % 100),
        "last_month": periods.month_string(*periods.last_month()),
        "last_complete_month": periods.month_string(*periods.last_complete_month()),
        "data_through": periods.data_through().isoformat(),
        "countries": countries,
        "presets": [{"id": p["id"], "name": p["name"], "bbox": p["bbox"]} for p in presets],
        "eras": config.ERAS,
        "harmonization": db.harmonization(),
    }
