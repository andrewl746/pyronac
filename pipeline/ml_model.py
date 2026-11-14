"""ML model: can gradient boosting beat the ratio method at turning MODIS into the VIIRS scale?

Usage, from the repo root:
    python pipeline/ml_model.py           compare versions inside 2012 to 2019, one year left out at a time
    python pipeline/ml_model.py --test    the same, then the final test: learn on 2012 to 2019, test on 2020 to 2025
    add --fixtures to run on the small fake data set

The model predicts, for a cell and month, how many hot spots Suomi NPP reported, from what MODIS saw.
Every input comes from MODIS detections alone, so the model can be applied to 2003 to 2011.
It is HistGradientBoostingRegressor(loss="poisson"), split by year, never at random.

Rule (MASTERSPEC.md, Andrew L step 3): versions are chosen inside 2012 to 2019 only. The years
2020 to 2025 are used once, for the final comparison with the ratio method, never for tuning.

MODIS misses some fires completely. Suomi NPP detections in a cell and month with no MODIS
detection are shared out among the cells of the same 1 degree block that MODIS did see, in
proportion to their MODIS counts. That way the model's totals include them, as the ratio method's do.

Uses numpy and pyarrow, not pandas.
"""
import argparse
import json
from statistics import median

import duckdb
import numpy as np
import pyarrow as pa
from sklearn.ensemble import HistGradientBoostingRegressor

import config
import harmonize
import validate

TRAIN_FROM_YM = validate.TRAIN_FROM_YM   # 201202
TRAIN_TO_YM = validate.TRAIN_TO_YM       # 201912
TEST_FROM_YM = validate.TEST_FROM_YM     # 202001
TEST_TO_YM = validate.TEST_TO_YM         # 202512

MIN_MONTH_TOTAL = validate.MIN_TOTAL     # 20, the same cut-off validate.py uses
MIN_REGION_TOTAL = 200                   # a 5 degree region and year needs this many Suomi NPP detections to count

FEATURES = {
    # The inputs listed in the task sheet.
    "basic": ["modis_count", "modis_frp_sum", "month", "lat", "lon", "near_8", "near_24"],
}
FEATURES["wide"] = FEATURES["basic"] + [
    "frp_mean", "block_modis", "country_month", "country_year", "prev_count", "next_count",
]
FEATURES["full"] = FEATURES["wide"] + [
    "terra_count", "aqua_count", "day_count", "night_count", "high_count", "frp_max", "active_days",
]

SETTINGS = {
    "default": {},
    "careful": {"learning_rate": 0.05, "max_iter": 300, "max_leaf_nodes": 15, "min_samples_leaf": 50,
                "l2_regularization": 1.0},
}
# "count" predicts the Suomi NPP count directly. "rate" predicts Suomi NPP per MODIS detection,
# weighted by the MODIS count, and multiplies back. A rate can follow a fire bigger than any in training.
TARGETS = ["count", "rate"]

# The version chosen inside 2012 to 2019 and then tested once on 2020 to 2025. harmonize.run() uses it.
CHOSEN = ("count", "full", "careful")
MIN_ROWS = 500  # with fewer cell-months than this to learn from, the build keeps the ratio method


def load(con, data_dir, keep_grid_counts=False):
    """Build the table feat (one row per cell and month that MODIS saw) and the table g (every row).

    keep_grid_counts is for the build, where the table grid_counts is already in `con`.
    """
    folder = data_dir.as_posix()
    if not keep_grid_counts:
        con.execute(f"CREATE OR REPLACE TABLE grid_counts AS SELECT * FROM read_parquet('{folder}/grid_counts.parquet')")
    con.execute(
        f"""
        CREATE OR REPLACE TABLE modis_detail AS
        SELECT
            cell_x, cell_y, year, month,
            count(*) FILTER (WHERE satellite = 'Terra') AS terra_count,
            count(*) FILTER (WHERE satellite = 'Aqua') AS aqua_count,
            count(*) FILTER (WHERE daynight = 'D') AS day_count,
            count(*) FILTER (WHERE daynight = 'N') AS night_count,
            count(*) FILTER (WHERE confidence = 'high') AS high_count,
            max(frp) AS frp_max,
            count(DISTINCT acq_date) AS active_days
        FROM read_parquet('{folder}/points/*/*.parquet', hive_partitioning = true)
        WHERE sensor = 'MODIS'
        GROUP BY 1, 2, 3, 4
        """
    )
    con.execute(
        """
        CREATE OR REPLACE TABLE g AS
        SELECT *,
               year * 100 + month AS ym,
               year * 12 + month AS month_index,
               CAST(floor(cell_x / 10.0) AS INTEGER) AS block_x,
               CAST(floor(cell_y / 10.0) AS INTEGER) AS block_y
        FROM grid_counts
        """
    )
    con.execute(
        """
        CREATE OR REPLACE TABLE feat AS
        WITH near AS (
            -- Each MODIS cell is copied to the 25 cells of the 5 by 5 window around it, then joined on
            -- equality. A range join here pairs every cell with every cell of the same month, which
            -- runs out of disk on all three countries.
            SELECT
                a.cell_x, a.cell_y, a.year, a.month,
                sum(b.modis_count) FILTER (WHERE b.inner_ring) - any_value(a.modis_count) AS near_8,
                sum(b.modis_count) - any_value(a.modis_count) AS near_24
            FROM g a
            JOIN (
                SELECT s.cell_x + o.dx AS cell_x, s.cell_y + o.dy AS cell_y, s.year, s.month, s.modis_count,
                       abs(o.dx) <= 1 AND abs(o.dy) <= 1 AS inner_ring
                FROM g s
                CROSS JOIN (SELECT CAST(dx.range AS INTEGER) AS dx, CAST(dy.range AS INTEGER) AS dy
                            FROM range(-2, 3) dx, range(-2, 3) dy) o
                WHERE s.modis_count > 0
            ) b USING (cell_x, cell_y, year, month)
            WHERE a.modis_count > 0
            GROUP BY 1, 2, 3, 4
        ),
        block AS (
            SELECT block_x, block_y, year, month,
                   sum(modis_count) AS block_modis,
                   coalesce(sum(snpp_count) FILTER (WHERE modis_count = 0), 0) AS missed
            FROM g GROUP BY 1, 2, 3, 4
        ),
        country_month AS (SELECT country, year, month, sum(modis_count) AS country_month FROM g GROUP BY 1, 2, 3),
        country_year AS (SELECT country, year, sum(modis_count) AS country_year FROM g GROUP BY 1, 2)
        SELECT
            g.country, g.cell_x, g.cell_y, g.year, g.month, g.ym, g.block_x, g.block_y,
            g.snpp_count,
            g.snpp_count + g.modis_count * 1.0 / block.block_modis * block.missed AS snpp_target,
            g.modis_count, g.modis_frp_sum,
            g.modis_frp_sum / g.modis_count AS frp_mean,
            (g.cell_y + 0.5) / 10.0 AS lat,
            (g.cell_x + 0.5) / 10.0 AS lon,
            near.near_8, near.near_24,
            block.block_modis, country_month.country_month, country_year.country_year,
            coalesce(p.modis_count, 0) AS prev_count,
            coalesce(n.modis_count, 0) AS next_count,
            d.terra_count, d.aqua_count, d.day_count, d.night_count, d.high_count, d.frp_max, d.active_days
        FROM g
        JOIN near USING (cell_x, cell_y, year, month)
        JOIN block USING (block_x, block_y, year, month)
        JOIN country_month USING (country, year, month)
        JOIN country_year USING (country, year)
        LEFT JOIN g p ON p.cell_x = g.cell_x AND p.cell_y = g.cell_y AND p.month_index = g.month_index - 1
        LEFT JOIN g n ON n.cell_x = g.cell_x AND n.cell_y = g.cell_y AND n.month_index = g.month_index + 1
        LEFT JOIN modis_detail d USING (cell_x, cell_y, year, month)
        WHERE g.modis_count > 0
        """
    )


def rows_with_ratio(con, where, skip_year=None):
    """Rows of feat matching `where`, with the ratio method's estimates added, as numpy arrays.

    ratio is our block and month method, flat is one ratio for the country. Both are learned
    on the training years, leaving out skip_year when given.
    """
    harmonize.learn_ratios(con, TRAIN_FROM_YM, TRAIN_TO_YM, skip_year=skip_year)
    return con.execute(
        f"""
        SELECT g.*,
               g.modis_count * {harmonize.RATIO_SQL} AS ratio,
               g.modis_count * coalesce(c.ratio, 1.0) AS flat
        FROM feat g
        {harmonize.RATIO_JOINS}
        WHERE {where}
        ORDER BY g.cell_x, g.cell_y, g.year, g.month
        """
    ).fetchnumpy()


def rows_of(con, where):
    """Rows of feat matching `where`, always in the same order, so a rerun gives the same model."""
    return con.execute(
        f"SELECT * FROM feat g WHERE {where} ORDER BY g.cell_x, g.cell_y, g.year, g.month"
    ).fetchnumpy()


def apply(con, data_dir):
    """Used by harmonize.run(). Fits the chosen version and estimates every MODIS-era row.

    Creates the table ml_estimate (cell_x, cell_y, year, month, estimate). Returns None when there is
    too little data to learn from, otherwise a dict with the errors on the test years (or None for
    them when the data has no test years).
    """
    load(con, data_dir, keep_grid_counts=True)
    target, features, settings = CHOSEN
    train_months = f"g.ym BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}"
    test_months = f"g.ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}"
    overlap = f"g.ym BETWEEN {TRAIN_FROM_YM} AND {config.SNPP_ERA_END_YM}"
    if con.execute(f"SELECT count(*) FROM feat g WHERE {overlap}").fetchone()[0] < MIN_ROWS:
        return None

    tested = None
    train = rows_of(con, train_months)
    test = rows_of(con, test_months)
    if len(train["year"]) >= MIN_ROWS and len(test["year"]) > 0:
        store(con, "tested", test, [fit_predict(train, test, FEATURES[features], settings, target)], append=False)
        tested = scores(con, "tested", ["ml"], f"ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}")["ml"]

    # The model the app uses learns from every month both instruments flew.
    everything = rows_of(con, overlap)
    old = rows_of(con, f"g.ym <= {config.MODIS_ERA_END_YM}")
    estimate = fit_predict(everything, old, FEATURES[features], settings, target) if len(old["year"]) else []
    store(con, "ml_rows", old, [estimate], append=False)
    con.execute("CREATE OR REPLACE TABLE ml_estimate AS SELECT cell_x, cell_y, year, month, e0 AS estimate FROM ml_rows")
    return {"version": name_of(CHOSEN), "test": tested, "rows": len(everything["year"])}


def matrix(rows, features):
    """The feature columns as one float array. Missing values become NaN, which the model accepts."""
    return np.column_stack([np.ma.filled(np.ma.asarray(rows[name]).astype(float), np.nan) for name in features])


def fit_predict(train, test, features, settings, target):
    model = HistGradientBoostingRegressor(loss="poisson", random_state=0, **SETTINGS[settings])
    count = np.asarray(train["modis_count"], dtype=float)
    wanted = np.asarray(train["snpp_target"], dtype=float)
    if target == "rate":
        model.fit(matrix(train, features), wanted / count, sample_weight=count)
        return model.predict(matrix(test, features)) * np.asarray(test["modis_count"], dtype=float)
    model.fit(matrix(train, features), wanted)
    return model.predict(matrix(test, features))


def store(con, table, rows, estimates, append):
    """Put the keys of `rows` and the estimate arrays into a DuckDB table, columns e0, e1, ..."""
    data = {key: np.asarray(rows[key]) for key in ("cell_x", "cell_y", "year", "month", "block_x", "block_y")}
    data["country"] = pa.array([str(value) for value in rows["country"]])
    for i, values in enumerate(estimates):
        data[f"e{i}"] = np.asarray(values, dtype=float)
    con.register("incoming", pa.table(data))
    if append:
        con.execute(f"INSERT INTO {table} BY NAME SELECT * FROM incoming")
    else:
        con.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT * FROM incoming")
    con.unregister("incoming")


def scores(con, table, names, where):
    """Errors of each estimate against what Suomi NPP reported, at three levels.

    `table` has one row per cell and month with a column e0, e1, ... per estimate in `names`.
    The truth includes detections in cells MODIS missed. `where` selects the same months from g.
    """
    region = "CAST(floor(block_x / 5.0) AS INTEGER), CAST(floor(block_y / 5.0) AS INTEGER), year"
    levels = {
        "monthly": ("country, year, month", MIN_MONTH_TOTAL),
        "yearly": ("country, year", MIN_MONTH_TOTAL),
        "region": (region, MIN_REGION_TOTAL),
    }
    sums = ", ".join(f"sum(e{i})" for i in range(len(names)))
    out = {name: {} for name in names}
    for level, (keys, minimum) in levels.items():
        n_keys = 3 if level != "yearly" else 2
        actual = {row[:n_keys]: row[n_keys] for row in con.execute(
            f"SELECT {keys}, sum(snpp_count) FROM g WHERE {where} GROUP BY ALL HAVING sum(snpp_count) >= {minimum}"
        ).fetchall()}
        estimate = {row[:n_keys]: row[n_keys:] for row in con.execute(
            f"SELECT {keys}, {sums} FROM {table} GROUP BY ALL"
        ).fetchall()}
        for i, name in enumerate(names):
            errors = [abs((estimate[key][i] if key in estimate else 0.0) - snpp) / snpp for key, snpp in actual.items()]
            out[name][level] = median(errors) if errors else None
            out[name][level + "_n"] = len(errors)
    total = con.execute(f"SELECT sum(snpp_count) FROM g WHERE {where}").fetchone()[0]
    totals = con.execute(f"SELECT {sums} FROM {table}").fetchone()
    for i, name in enumerate(names):
        out[name]["bias"] = totals[i] / total if total else None
    return out


def show(title, result, order):
    print(title)
    print("| Method | Canada, monthly | Canada, yearly | 5 degree regions, yearly | Total vs observed |")
    print("|---|---|---|---|---|")
    for name in order:
        r = result[name]
        cells = " | ".join("n/a" if r[k] is None else f"{r[k] * 100:.1f}%" for k in ("monthly", "yearly", "region"))
        bias = "n/a" if r["bias"] is None else f"{(r['bias'] - 1) * 100:+.1f}%"
        print(f"| {name} | {cells} | {bias} |")
    first = result[order[0]]
    print(f"({first['monthly_n']} months, {first['yearly_n']} years, {first['region_n']} region-years)")
    print()


def variants():
    return [(target, features, settings) for target in TARGETS for features in FEATURES for settings in SETTINGS]


def name_of(variant):
    return "ml " + "-".join(variant)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fixtures", action="store_true", help="run on the small fake data set")
    parser.add_argument("--test", action="store_true", help="also run the final test on 2020 to 2025")
    args = parser.parse_args()
    data_dir = config.FIXTURES_DIR if args.fixtures else config.PROCESSED_DIR

    con = duckdb.connect()
    load(con, data_dir)
    train_months = f"g.ym BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}"
    years = [row[0] for row in con.execute(f"SELECT DISTINCT year FROM feat g WHERE {train_months} ORDER BY 1").fetchall()]
    n_train = con.execute(f"SELECT count(*) FROM feat g WHERE {train_months}").fetchone()[0]
    print(f"Data: {data_dir}")
    print(f"Cell-months MODIS saw in {years[0]} to {years[-1]}: {n_train:,d}")
    print()

    # 1. Inside the training years: leave one year out, learn on the rest, predict the year left out.
    names = ["flat", "ratio"] + [name_of(v) for v in variants()]
    for position, year in enumerate(years):
        held = rows_with_ratio(con, f"{train_months} AND g.year = {year}", skip_year=year)
        train = rows_of(con, f"{train_months} AND g.year <> {year}")
        estimates = [held["flat"], held["ratio"]]
        for target, features, settings in variants():
            estimates.append(fit_predict(train, held, FEATURES[features], settings, target))
        store(con, "held_out", held, estimates, append=position > 0)
        print(f"  left out {year}: done", flush=True)
    print()
    inside_months = f"ym BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}"
    inside = scores(con, "held_out", names, inside_months)
    show(f"Inside {years[0]} to {years[-1]}, one year left out at a time "
         "(flat = one ratio for the country, ratio = our block and month ratio):", inside, names)

    def mean_error(name):
        return sum(inside[name][k] for k in ("monthly", "yearly", "region")) / 3

    best = min(variants(), key=lambda v: mean_error(name_of(v)))
    print(f"Best ML version by the mean of the three errors: {name_of(best)} "
          f"({mean_error(name_of(best)) * 100:.1f}%, against {mean_error('ratio') * 100:.1f}% for the ratio method)")
    print()

    result = {"inside": {name: inside[name] for name in names}, "best": name_of(best), "test": None}
    if args.test:
        # 2. The final test, run once: learn on all the training years, predict 2020 to 2025.
        test_months = f"g.ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}"
        test = rows_with_ratio(con, test_months)
        if len(test["year"]) == 0:
            print("No test years in the data.")
        else:
            train = rows_of(con, train_months)
            target, features, settings = best
            final_names = ["flat", "ratio", name_of(best)]
            store(con, "tested", test,
                  [test["flat"], test["ratio"], fit_predict(train, test, FEATURES[features], settings, target)],
                  append=False)
            final = scores(con, "tested", final_names, f"ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}")
            show("Final test: learned on 2012 to 2019, tested on 2020 to 2025:", final, final_names)
            result["test"] = {name: final[name] for name in final_names}

    path = data_dir / "ml_result.json"
    path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
