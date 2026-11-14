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

# The version chosen inside 2012 to 2019 and then tested once on 2020 to 2025 on Canada.
CHOSEN = ("count", "full", "careful")
MIN_ROWS = 500  # with fewer cell-months than this to learn from, the build keeps the ratio method

# Per-country check (--per-country). A model is either "pooled", learned from every country at once,
# or "country", learned from that country's own cell-months only. These are the candidates compared
# inside 2012 to 2019 for each country.
COUNTRY_CANDIDATES = [("pooled",) + CHOSEN] + [
    ("country", target, features, "careful") for target in TARGETS for features in ("basic", "full")
]
# The rule, fixed before the per-country test was run: a country uses its model only if, on 2020 to
# 2025, the model is lower than the ratio method on monthly, yearly and regional totals, and at least
# 2 points lower on monthly totals. Otherwise that country uses the ratio method.
MONTHLY_MARGIN = 0.02

# Which model each country uses in the build. A country not listed uses the ratio method.
# None means the model in CHOSEN, learned from every country, for every country.
# Decided on 14 November 2026 by `python pipeline/ml_model.py --per-country --test` on Canada, India
# and Brazil, 2003 to 2026: only Canada's model passed the rule above on 2020 to 2025. India and Brazil
# use the ratio method. See docs/METHOD.md.
MODEL_FOR = {"canada": ("country", "rate", "full", "careful")}


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
        WITH offsets AS (
            SELECT ox.range AS dx, oy.range AS dy FROM range(-2, 3) ox, range(-2, 3) oy
        ),
        spread AS (
            -- Each MODIS count copied onto the 5 x 5 cells around it, so the neighbour sums are a fast
            -- equality join. dx and dy say how far away the count came from.
            SELECT b.cell_x - o.dx AS cell_x, b.cell_y - o.dy AS cell_y, b.year, b.month, o.dx, o.dy, b.modis_count
            FROM g b CROSS JOIN offsets o
            WHERE b.modis_count > 0
        ),
        near AS (
            SELECT
                a.cell_x, a.cell_y, a.year, a.month,
                coalesce(sum(s.modis_count) FILTER (WHERE abs(s.dx) <= 1 AND abs(s.dy) <= 1
                                                      AND NOT (s.dx = 0 AND s.dy = 0)), 0) AS near_8,
                coalesce(sum(s.modis_count) FILTER (WHERE NOT (s.dx = 0 AND s.dy = 0)), 0) AS near_24
            FROM g a
            JOIN spread s USING (cell_x, cell_y, year, month)
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
        country_year AS (SELECT country, year, sum(modis_count) AS country_year FROM g GROUP BY 1, 2),
        -- The MODIS count of the month before and after, 0 when that month has no row. A window, not
        -- two self-joins: with two, DuckDB joins them to each other on the cell alone and runs out of disk.
        -- (Found and fixed by Yuvi in pull request 28.)
        around AS (
            SELECT cell_x, cell_y, year, month,
                   CASE WHEN lag(month_index) OVER w = month_index - 1 THEN lag(modis_count) OVER w ELSE 0 END
                       AS prev_count,
                   CASE WHEN lead(month_index) OVER w = month_index + 1 THEN lead(modis_count) OVER w ELSE 0 END
                       AS next_count
            FROM g
            WINDOW w AS (PARTITION BY cell_x, cell_y ORDER BY month_index)
        )
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
            around.prev_count, around.next_count,
            d.terra_count, d.aqua_count, d.day_count, d.night_count, d.high_count, d.frp_max, d.active_days
        FROM g
        JOIN near USING (cell_x, cell_y, year, month)
        JOIN block USING (block_x, block_y, year, month)
        JOIN country_month USING (country, year, month)
        JOIN country_year USING (country, year)
        JOIN around USING (cell_x, cell_y, year, month)
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
    """Used by harmonize.run(). Estimates every MODIS-era row of the countries that use a model.

    Which model each country uses is MODEL_FOR. Countries without one get no estimate, so harmonize.run()
    uses the ratio method for them. Creates the table ml_estimate (cell_x, cell_y, year, month, estimate).
    Returns None when no country uses a model or there is too little data, otherwise a dict with the
    plan and the errors on the test years of what is actually shipped: the model where a country uses
    one, the ratio method elsewhere (None when the data has no test years).
    """
    load(con, data_dir, keep_grid_counts=True)
    train_months = f"g.ym BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}"
    overlap = f"g.ym BETWEEN {TRAIN_FROM_YM} AND {config.SNPP_ERA_END_YM}"
    if con.execute(f"SELECT count(*) FROM feat g WHERE {overlap}").fetchone()[0] < MIN_ROWS:
        return None
    countries = [row[0] for row in con.execute("SELECT DISTINCT country FROM feat ORDER BY 1").fetchall()]
    if MODEL_FOR is None:
        plan = {country: ("pooled",) + CHOSEN for country in countries}
    else:
        plan = {country: tuple(MODEL_FOR[country]) for country in countries if country in MODEL_FOR}
    if not plan:
        return None

    def estimates_for(train, rows):
        out = np.full(len(rows["year"]), np.nan)
        row_country = np.array([str(value) for value in rows["country"]])
        for variant in sorted(set(plan.values())):
            estimate = fit_predict_scoped(train, rows, variant)
            for country, wanted in plan.items():
                if wanted == variant:
                    out[row_country == country] = estimate[row_country == country]
        return out

    tested = None
    train = rows_of(con, train_months)
    if len(train["year"]) >= MIN_ROWS:
        test = rows_with_ratio(con, f"g.ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}")
        if len(test["year"]):
            shipped = np.asarray(test["ratio"], dtype=float).copy()
            model = estimates_for(train, test)
            shipped[~np.isnan(model)] = model[~np.isnan(model)]
            store(con, "tested", test, [shipped], append=False)
            tested = scores(con, "tested", ["shipped"], f"ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}")["shipped"]
        # rows_with_ratio learned ratios on the training years only. Put back the ones the build uses.
        harmonize.learn_ratios(con, harmonize.OVERLAP_FROM_YM, config.SNPP_ERA_END_YM)

    # The models the app uses learn from every month both instruments flew.
    everything = rows_of(con, overlap)
    old = rows_of(con, f"g.ym <= {config.MODIS_ERA_END_YM}")
    estimate = estimates_for(everything, old) if len(old["year"]) else np.array([])
    keep = ~np.isnan(estimate)
    store(con, "ml_rows", subset(old, keep), [estimate[keep]], append=False)
    con.execute("CREATE OR REPLACE TABLE ml_estimate AS SELECT cell_x, cell_y, year, month, e0 AS estimate FROM ml_rows")
    # The cell-months the shipped models learned from: every country's for a pooled model, the
    # country's own for a per-country model.
    learned_country = np.array([str(value) for value in everything["country"]])
    pooled = any(variant[0] == "pooled" for variant in plan.values())
    rows = len(learned_country) if pooled else int(np.isin(learned_country, list(plan)).sum())
    return {
        "plan": {country: name_of(variant) for country, variant in plan.items()},
        "test": tested,
        "rows": rows,
    }


def subset(rows, mask):
    return {name: values[mask] for name, values in rows.items()}


def fit_predict_scoped(train, test, variant):
    """Like fit_predict, for a variant (scope, target, features, settings).

    "pooled" learns one model from every country. "country" learns one model per country, from that
    country's rows only, and predicts that country's rows with it.
    """
    scope, target, features, settings = variant
    if scope == "pooled":
        return fit_predict(train, test, FEATURES[features], settings, target)
    out = np.full(len(test["year"]), np.nan)
    train_country = np.array([str(value) for value in train["country"]])
    test_country = np.array([str(value) for value in test["country"]])
    for country in np.unique(test_country):
        own = train_country == country
        if own.sum() < MIN_ROWS:
            continue  # left as NaN: too little to learn from
        mask = test_country == country
        out[mask] = fit_predict(subset(train, own), subset(test, mask), FEATURES[features], settings, target)
    return out


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

    # The same errors for each country on its own, at the same three levels.
    for name in names:
        out[name]["by_country"] = {}
    country_levels = (
        ("monthly", "country, year, month", MIN_MONTH_TOTAL),
        ("yearly", "country, year", MIN_MONTH_TOTAL),
        ("region", "country, " + region, MIN_REGION_TOTAL),
    )
    for level, keys, minimum in country_levels:
        n_keys = keys.count(",") + 1
        actual = con.execute(
            f"SELECT {keys}, sum(snpp_count) FROM g WHERE {where} GROUP BY ALL HAVING sum(snpp_count) >= {minimum}"
        ).fetchall()
        estimate = {row[:n_keys]: row[n_keys:] for row in con.execute(
            f"SELECT {keys}, {sums} FROM {table} GROUP BY ALL"
        ).fetchall()}
        for i, name in enumerate(names):
            errors = {}
            for row in actual:
                key, snpp = row[:n_keys], row[n_keys]
                value = estimate[key][i] if key in estimate else 0.0
                errors.setdefault(key[0], []).append(abs(value - snpp) / snpp)
            for country, values in errors.items():
                out[name]["by_country"].setdefault(country, {})[level] = median(values)
                out[name]["by_country"][country][level + "_n"] = len(values)
    return out


def show(title, result, order):
    print(title)
    print("| Method | Monthly, all countries | Yearly, all countries | 5 degree regions, yearly | Total vs observed |")
    print("|---|---|---|---|---|")
    for name in order:
        r = result[name]
        cells = " | ".join("n/a" if r[k] is None else f"{r[k] * 100:.1f}%" for k in ("monthly", "yearly", "region"))
        bias = "n/a" if r["bias"] is None else f"{(r['bias'] - 1) * 100:+.1f}%"
        print(f"| {name} | {cells} | {bias} |")
    first = result[order[0]]
    print(f"({first['monthly_n']} country-months, {first['yearly_n']} country-years, {first['region_n']} region-years)")
    countries = sorted(first["by_country"])
    if len(countries) > 1:
        print()
        print("| Method | Country | Monthly | Yearly | 5 degree regions, yearly |")
        print("|---|---|---|---|---|")
        for country in countries:
            for name in order:
                r = result[name]["by_country"].get(country, {})
                cells = " | ".join("n/a" if r.get(k) is None else f"{r[k] * 100:.1f}%"
                                   for k in ("monthly", "yearly", "region"))
                print(f"| {name} | {country} | {cells} |")
    print()


ONLY_CHOSEN = False  # set by --chosen-only: compare just CHOSEN with the ratio method, which is much faster


def variants():
    if ONLY_CHOSEN:
        return [CHOSEN]
    return [(target, features, settings) for target in TARGETS for features in FEATURES for settings in SETTINGS]


def name_of(variant):
    return "ml " + "-".join(variant)


def per_country(con, data_dir, run_test):
    """Choose a model for each country inside 2012 to 2019, then test each choice once on 2020 to 2025.

    The candidates are COUNTRY_CANDIDATES. Each country's choice is the candidate with the lowest mean
    of its three errors inside 2012 to 2019. The test applies the rule above MONTHLY_MARGIN.
    """
    train_months = f"g.ym BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}"
    years = [row[0] for row in con.execute(f"SELECT DISTINCT year FROM feat g WHERE {train_months} ORDER BY 1").fetchall()]
    names = ["flat", "ratio"] + [name_of(v) for v in COUNTRY_CANDIDATES]
    for position, year in enumerate(years):
        held = rows_with_ratio(con, f"{train_months} AND g.year = {year}", skip_year=year)
        train = rows_of(con, f"{train_months} AND g.year <> {year}")
        estimates = [held["flat"], held["ratio"]] + [fit_predict_scoped(train, held, v) for v in COUNTRY_CANDIDATES]
        store(con, "held_out", held, estimates, append=position > 0)
        print(f"  left out {year}: done", flush=True)
    print()
    inside = scores(con, "held_out", names, f"ym BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}")
    show(f"Inside {years[0]} to {years[-1]}, one year left out at a time:", inside, names)

    def mean_error(name, country):
        r = inside[name]["by_country"].get(country, {})
        values = [r.get(k) for k in ("monthly", "yearly", "region")]
        return sum(values) / 3 if all(v is not None for v in values) else float("inf")

    countries = sorted(inside["ratio"]["by_country"])
    choice = {c: min(COUNTRY_CANDIDATES, key=lambda v: mean_error(name_of(v), c)) for c in countries}
    for c in countries:
        print(f"Chosen for {c}: {name_of(choice[c])} ({mean_error(name_of(choice[c]), c) * 100:.1f}%, "
              f"ratio method {mean_error('ratio', c) * 100:.1f}%)")
    print()
    result = {"inside": inside, "choice": {c: list(v) for c, v in choice.items()}, "test": None, "decision": None}
    if not run_test:
        return result

    # The final test, run once: each country's choice, learned on all of 2012 to 2019.
    test = rows_with_ratio(con, f"g.ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}")
    train = rows_of(con, train_months)
    test_country = np.array([str(value) for value in test["country"]])
    chosen = np.full(len(test["year"]), np.nan)
    for variant in sorted(set(choice.values())):
        estimate = fit_predict_scoped(train, test, variant)
        for c in countries:
            if choice[c] == variant:
                chosen[test_country == c] = estimate[test_country == c]
    final_names = ["flat", "ratio", "model"]
    store(con, "tested", test, [test["flat"], test["ratio"], chosen], append=False)
    final = scores(con, "tested", final_names, f"ym BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}")
    show("Final test, learned on 2012 to 2019, tested on 2020 to 2025 (model = each country's choice):",
         final, final_names)

    decision = {}
    for c in countries:
        m, r = final["model"]["by_country"][c], final["ratio"]["by_country"][c]
        wins = (m["monthly"] <= r["monthly"] - MONTHLY_MARGIN and m["yearly"] < r["yearly"]
                and m["region"] < r["region"])
        decision[c] = list(choice[c]) if wins else "ratio"
        print(f"{c}: {'model ' + name_of(choice[c]) if wins else 'ratio method'} "
              f"(monthly {m['monthly'] * 100:.1f}% against {r['monthly'] * 100:.1f}%, "
              f"yearly {m['yearly'] * 100:.1f}% against {r['yearly'] * 100:.1f}%, "
              f"regions {m['region'] * 100:.1f}% against {r['region'] * 100:.1f}%)")
    result["test"] = {name: final[name] for name in final_names}
    result["decision"] = decision
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fixtures", action="store_true", help="run on the small fake data set")
    parser.add_argument("--test", action="store_true", help="also run the final test on 2020 to 2025")
    parser.add_argument("--chosen-only", action="store_true",
                        help="compare only the chosen version with the ratio method (for re-checking on new countries)")
    parser.add_argument("--per-country", action="store_true",
                        help="choose a model for each country and decide, country by country, model or ratio")
    args = parser.parse_args()
    global ONLY_CHOSEN
    ONLY_CHOSEN = args.chosen_only
    data_dir = config.FIXTURES_DIR if args.fixtures else config.PROCESSED_DIR

    con = duckdb.connect()
    load(con, data_dir)
    if args.per_country:
        print(f"Data: {data_dir}")
        print()
        result = per_country(con, data_dir, args.test)
        path = data_dir / "ml_result_per_country.json"
        path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path}")
        return
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
