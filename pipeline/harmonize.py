"""Harmonization: put every month on the VIIRS Suomi NPP scale.

Method "ml" when the model in ml_model.py can be fitted: it estimates the MODIS era cell by cell.
Otherwise method "ratio", described here.

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

# Suomi NPP has outage days: days it reported (almost) nothing while NOAA-20 saw fires (56 days since 2018,
# including 10 to 16 July 2026). On a normal day it reports at least 62% of what NOAA-20 does 95% of the time.
OUTAGE_SHARE = 0.25       # a day is an outage when Suomi NPP reported under this share of NOAA-20's count
OUTAGE_MIN_NOAA20 = 20    # and NOAA-20 reported at least this many in the country that day

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


def fill_outages(con):
    """On Suomi NPP's outage days, use NOAA-20 times the Suomi NPP to NOAA-20 ratio instead.

    Needs the table clean, which the build has. Creates snpp_fill (cell_x, cell_y, year, month, fill): what to
    add to snpp_count in that cell and month. Without clean it stays empty and nothing changes.
    Returns the number of outage days.
    """
    con.execute("CREATE OR REPLACE TABLE snpp_fill (cell_x INTEGER, cell_y INTEGER, year INTEGER, month INTEGER, fill DOUBLE)")
    if not con.execute("SELECT count(*) FROM duckdb_tables() WHERE table_name = 'clean'").fetchone()[0]:
        return 0
    con.execute(
        f"""
        CREATE OR REPLACE TABLE outage_days AS
        SELECT country, acq_date
        FROM clean
        WHERE year * 100 + month BETWEEN {HANDOFF_FROM_YM} AND {config.SNPP_ERA_END_YM}
        GROUP BY 1, 2
        HAVING count(*) FILTER (WHERE satellite = 'NOAA20') >= {OUTAGE_MIN_NOAA20}
           AND count(*) FILTER (WHERE satellite = 'SNPP') < {OUTAGE_SHARE} * count(*) FILTER (WHERE satellite = 'NOAA20')
        """
    )
    # The ratio from the days when both satellites reported normally.
    con.execute(
        f"""
        CREATE OR REPLACE TABLE fill_ratio AS
        SELECT c.country,
               count(*) FILTER (WHERE c.satellite = 'SNPP') * 1.0 / count(*) FILTER (WHERE c.satellite = 'NOAA20') AS ratio
        FROM clean c
        LEFT JOIN outage_days o ON o.country = c.country AND o.acq_date = c.acq_date
        WHERE c.year * 100 + c.month BETWEEN {HANDOFF_FROM_YM} AND {HANDOFF_TO_YM}
          AND c.satellite IN ('SNPP', 'NOAA20') AND o.acq_date IS NULL
        GROUP BY 1
        HAVING count(*) FILTER (WHERE c.satellite = 'NOAA20') > 0
        """
    )
    # Each fill is rounded to a multiple of 1/1024. Such numbers add up exactly in floating point, so the
    # filled counts, and every sum of them that the ratios and the model use, come out the same in any
    # order. Otherwise sums added up across threads would change in their last digits from one build to
    # the next, and that is enough to change the model (see ml_model.py). The rounding moves a cell's
    # count by at most 0.0005.
    con.execute(
        """
        INSERT INTO snpp_fill
        SELECT cell_x, cell_y, year, month, sum(fill)
        FROM (
            SELECT c.cell_x, c.cell_y, c.year, c.month,
                   round((count(*) FILTER (WHERE c.satellite = 'NOAA20') * r.ratio
                          - count(*) FILTER (WHERE c.satellite = 'SNPP')) * 1024) / 1024 AS fill
            FROM clean c
            JOIN outage_days o ON o.country = c.country AND o.acq_date = c.acq_date
            JOIN fill_ratio r ON r.country = c.country
            WHERE c.satellite IN ('SNPP', 'NOAA20')
            GROUP BY c.cell_x, c.cell_y, c.year, c.month, c.country, r.ratio
        )
        GROUP BY 1, 2, 3, 4
        """
    )
    return con.execute("SELECT count(*) FROM outage_days").fetchone()[0]


def apply_saved_fill(con, data_dir):
    """For scripts that read grid_counts.parquet on their own (validate.py, ml_model.py): fill Suomi NPP's
    outage days in the table grid_counts the way the build did, from snpp_fill.parquet. No file, no change."""
    path = Path(data_dir) / "snpp_fill.parquet"
    if not path.exists():
        return
    con.execute(
        f"""
        CREATE OR REPLACE TABLE grid_counts AS
        SELECT g.* REPLACE (g.snpp_count + coalesce(f.fill, 0) AS snpp_count)
        FROM grid_counts g
        LEFT JOIN read_parquet('{path.as_posix()}') f USING (cell_x, cell_y, year, month)
        """
    )


def run(con, out_dir, data_through):
    """Read the table grid_counts in `con`, create the table grid, write harmonization.json.

    grid has every column of grid_counts plus harmonized_count (DOUBLE, never null, never negative).
    """
    import validate  # here, not at the top, because validate imports this module

    # While learning and validating, Suomi NPP's outage days are filled from NOAA-20. The published tables
    # keep what Suomi NPP observed, so the served detections still match them.
    outage_days = fill_outages(con)
    fill_path = Path(out_dir) / "snpp_fill.parquet"
    if con.execute("SELECT count(*) FROM snpp_fill").fetchone()[0]:
        con.execute(f"COPY snpp_fill TO '{fill_path.as_posix()}' (FORMAT PARQUET)")
    elif fill_path.exists():
        fill_path.unlink()
    con.execute("CREATE OR REPLACE TABLE grid_counts_observed AS SELECT * FROM grid_counts")
    con.execute(
        """
        CREATE OR REPLACE TABLE grid_counts AS
        SELECT g.* REPLACE (g.snpp_count + coalesce(f.fill, 0) AS snpp_count)
        FROM grid_counts_observed g
        LEFT JOIN snpp_fill f USING (cell_x, cell_y, year, month)
        """
    )

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

    pooled = con.execute(
        f"""
        SELECT sum(snpp_count) * 1.0 / nullif(sum(noaa20_count), 0)
        FROM grid_counts
        WHERE year * 100 + month BETWEEN {HANDOFF_FROM_YM} AND {HANDOFF_TO_YM}
          AND country IN (SELECT country FROM ratio_handoff)
        """
    ).fetchone()[0]
    con.execute("CREATE OR REPLACE TABLE grid_counts AS SELECT * FROM grid_counts_observed")

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
                    THEN g.snpp_count + coalesce(f.fill, 0)
                ELSE g.noaa20_count * coalesce(h.ratio, 1.0)
            END AS DOUBLE) AS harmonized_count
        FROM grid_counts g
        {RATIO_JOINS}
        LEFT JOIN ratio_handoff h ON h.country = g.country
        LEFT JOIN ml_estimate e ON e.cell_x = g.cell_x AND e.cell_y = g.cell_y
                               AND e.year = g.year AND e.month = g.month
        LEFT JOIN snpp_fill f ON f.cell_x = g.cell_x AND f.cell_y = g.cell_y
                             AND f.year = g.year AND f.month = g.month
        """
    )

    country_ratios = con.execute("SELECT country, ratio FROM ratio_country ORDER BY 1").fetchall()
    handoffs = con.execute("SELECT country, ratio FROM ratio_handoff ORDER BY 1").fetchall()
    blocks = con.execute("SELECT count(*) FROM ratio_block").fetchone()[0]

    notes = (
        f"Suomi NPP to MODIS ratio per 1 degree block and calendar month ({blocks} block ratios), "
        f"falling back to the country's ratio for that calendar month, then the country's overall ratio. "
        "Overall ratios: " + ", ".join(f"{country} {ratio:.2f}" for country, ratio in country_ratios) + ". "
    )
    if handoffs:
        notes += "NOAA-20 handoff ratios: " + ", ".join(f"{country} {ratio:.3f}" for country, ratio in handoffs) + "."
    else:
        notes += "No months with both VIIRS satellites in the data, so the NOAA-20 handoff ratio is 1."
    if outage_days:
        notes += (f" On {outage_days} days Suomi NPP reported under {OUTAGE_SHARE:.0%} of NOAA-20's count (outages);"
                  " on those days the record uses NOAA-20 times the handoff ratio.")

    validation = result["validation"] if result else None
    if ml:
        all_countries = [country for country, _ in country_ratios]
        on_ratio = [country for country in all_countries if country not in ml["plan"]]
        notes = (
            "For 2003 to January 2012, a gradient boosting model estimates the Suomi NPP count of a cell and "
            "month from what MODIS saw, for "
            + ", ".join(f"{country} ({version})" for country, version in ml["plan"].items())
            + (f"; the ratio method is used for {', '.join(on_ratio)}, where it tested better" if on_ratio else "")
            + f". Models learned on {ml['rows']:,d} cell-months. Where a model has no estimate the ratio method "
            "is used. Ratio method: " + notes
        )
        if validation and ml["test"]:
            validation = dict(validation)
            validation["metric"] = validation["metric"].replace("ratios learned", "methods learned")
            validation["harmonized_error"] = round(ml["test"]["monthly"], 4)
        print(f"  ML model used for the MODIS era: {ml['plan']}; ratio method for: {on_ratio or 'none'}")

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
