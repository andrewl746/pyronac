"""Harmonization: put every month on the VIIRS Suomi NPP scale.

Method "ml" when the model in ml_model.py can be fitted: it estimates the MODIS era cell by cell.
Otherwise method "ratio" (MASTERSPEC.md section 6 and Andrew L's task sheet, step 2), described here.

For each 1 degree block and each calendar month, the ratio of Suomi NPP to MODIS
detections over the months when both flew. A block is used only when it has at least
MIN_MODIS MODIS detections in that calendar month over the training months. Otherwise
the country's ratio for that calendar month is used, and if that is thin too, the
country's overall ratio.

The inputs and outputs of run() are a contract and must not change.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import config

MIN_MODIS = 50            # MODIS detections a block or a country month needs before its own ratio is trusted
HANDOFF_FROM_YM = 201804  # months when both VIIRS satellites flew, used for the NOAA-20 handoff ratio
HANDOFF_TO_YM = 202510

OVERLAP_FROM_YM = 201202  # the first full month of Suomi NPP, the month after config.MODIS_ERA_END_YM

# Joins that attach the three levels of ratio to a table aliased g, and the ratio to use.
RATIO_JOINS = """
    LEFT JOIN ratio_block b
           ON b.country = g.country
          AND b.block_x = CAST(floor(g.cell_x / 10.0) AS INTEGER)
          AND b.block_y = CAST(floor(g.cell_y / 10.0) AS INTEGER)
          AND b.month = g.month
    LEFT JOIN ratio_month m ON m.country = g.country AND m.month = g.month
    LEFT JOIN ratio_country c ON c.country = g.country
"""
RATIO_SQL = "coalesce(b.ratio, m.ratio, c.ratio, 1.0)"


def learn_ratios(con, from_ym, to_ym, skip_year=None):
    """Learn the Suomi NPP to MODIS ratios from grid_counts, months from_ym to to_ym included.

    skip_year leaves one year out, for comparing versions of the method inside the training years.
    Creates the tables ratio_block, ratio_month and ratio_country.
    """
    months = f"year * 100 + month BETWEEN {int(from_ym)} AND {int(to_ym)}"
    if skip_year is not None:
        months += f" AND year <> {int(skip_year)}"
    con.execute(
        f"""
        CREATE OR REPLACE TABLE ratio_block AS
        SELECT
            country,
            CAST(floor(cell_x / 10.0) AS INTEGER) AS block_x,
            CAST(floor(cell_y / 10.0) AS INTEGER) AS block_y,
            month,
            sum(snpp_count) * 1.0 / sum(modis_count) AS ratio
        FROM grid_counts
        WHERE {months}
        GROUP BY 1, 2, 3, 4
        HAVING sum(modis_count) >= {MIN_MODIS} AND sum(snpp_count) > 0
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE ratio_month AS
        SELECT country, month, sum(snpp_count) * 1.0 / sum(modis_count) AS ratio
        FROM grid_counts
        WHERE {months}
        GROUP BY 1, 2
        HAVING sum(modis_count) >= {MIN_MODIS} AND sum(snpp_count) > 0
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE ratio_country AS
        SELECT country, sum(snpp_count) * 1.0 / sum(modis_count) AS ratio
        FROM grid_counts
        WHERE {months}
        GROUP BY 1
        HAVING sum(modis_count) > 0 AND sum(snpp_count) > 0
        """
    )


def learn_handoff(con):
    """Learn the Suomi NPP to NOAA-20 ratio per country. Creates the table ratio_handoff."""
    con.execute(
        f"""
        CREATE OR REPLACE TABLE ratio_handoff AS
        SELECT country, sum(snpp_count) * 1.0 / sum(noaa20_count) AS ratio
        FROM grid_counts
        WHERE year * 100 + month BETWEEN {HANDOFF_FROM_YM} AND {HANDOFF_TO_YM}
        GROUP BY 1
        HAVING sum(noaa20_count) > 0 AND sum(snpp_count) > 0
        """
    )


def run(con, out_dir, data_through):
    """Read the table grid_counts in `con`, create the table grid, write harmonization.json.

    grid has every column of grid_counts plus harmonized_count (DOUBLE, never null, never negative).
    """
    import validate  # here, not at the top, because validate imports this module

    # Validate first: it learns on the training years only and leaves its own ratio tables behind.
    result = validate.evaluate(con)

    # The ratios the app uses are learned on every month both instruments flew.
    learn_ratios(con, OVERLAP_FROM_YM, config.SNPP_ERA_END_YM)
    learn_handoff(con)

    # The ML model replaces the ratio for the MODIS era when it can be fitted. If scikit-learn is
    # missing or there is too little data, the ratio method is used and nothing else changes.
    con.execute(
        "CREATE OR REPLACE TABLE ml_estimate (cell_x INTEGER, cell_y INTEGER, year INTEGER, month INTEGER, estimate DOUBLE)"
    )
    ml = None
    try:
        import ml_model

        ml = ml_model.apply(con, Path(out_dir))
    except ImportError as error:
        print(f"  ML model not used, keeping the ratio method: {error}")

    con.execute(
        f"""
        CREATE OR REPLACE TABLE grid AS
        SELECT
            g.*,
            CAST(CASE
                WHEN g.year * 100 + g.month <= {config.MODIS_ERA_END_YM}
                    THEN CASE WHEN g.modis_count = 0 THEN 0
                              ELSE coalesce(e.estimate, g.modis_count * {RATIO_SQL}) END
                WHEN g.year * 100 + g.month <= {config.SNPP_ERA_END_YM}
                    THEN g.snpp_count
                ELSE g.noaa20_count * coalesce(h.ratio, 1.0)
            END AS DOUBLE) AS harmonized_count
        FROM grid_counts g
        {RATIO_JOINS}
        LEFT JOIN ratio_handoff h ON h.country = g.country
        LEFT JOIN ml_estimate e ON e.cell_x = g.cell_x AND e.cell_y = g.cell_y
                               AND e.year = g.year AND e.month = g.month
        """
    )

    country_ratios = con.execute("SELECT country, ratio FROM ratio_country ORDER BY 1").fetchall()
    handoffs = con.execute("SELECT country, ratio FROM ratio_handoff ORDER BY 1").fetchall()
    blocks = con.execute("SELECT count(*) FROM ratio_block").fetchone()[0]
    pooled = con.execute(
        f"""
        SELECT sum(snpp_count) * 1.0 / nullif(sum(noaa20_count), 0)
        FROM grid_counts
        WHERE year * 100 + month BETWEEN {HANDOFF_FROM_YM} AND {HANDOFF_TO_YM}
          AND country IN (SELECT country FROM ratio_handoff)
        """
    ).fetchone()[0]

    notes = (
        f"Suomi NPP to MODIS ratio per 1 degree block and calendar month ({blocks} block ratios), "
        f"falling back to the country's ratio for that calendar month, then the country's overall ratio. "
        "Overall ratios: " + ", ".join(f"{country} {ratio:.2f}" for country, ratio in country_ratios) + ". "
    )
    if handoffs:
        notes += "NOAA-20 handoff ratios: " + ", ".join(f"{country} {ratio:.3f}" for country, ratio in handoffs) + "."
    else:
        notes += "No months with both VIIRS satellites in the data, so the NOAA-20 handoff ratio is 1."

    validation = result["validation"] if result else None
    if ml:
        notes = (
            f"Gradient boosting model ({ml['version']}) that estimates the Suomi NPP count of a cell and month "
            f"from what MODIS saw, learned on {ml['rows']:,d} cell-months. Where the model has no estimate the "
            "ratio method is used. Ratio method: " + notes
        )
        if validation and ml["test"]:
            validation = dict(validation)
            validation["metric"] = validation["metric"].replace("ratios learned", "model learned")
            validation["harmonized_error"] = round(ml["test"]["monthly"], 4)
        print(f"  ML model used for the MODIS era: {ml['version']}")

    summary = {
        "method": "ml" if ml else "ratio",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_through": data_through,
        "reference": "VIIRS S-NPP 375 m",
        "handoff_ratio_noaa20": round(pooled, 4) if pooled else 1.0,
        "train_years": result["train_years"] if result else None,
        "test_years": result["test_years"] if result else None,
        "validation": validation,
        "notes": notes,
    }
    (Path(out_dir) / "harmonization.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
