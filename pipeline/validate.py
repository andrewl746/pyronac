"""Validation: does the ratio method work on years it never saw?

Usage, from the repo root:
    python pipeline/validate.py              real data  (data/processed)
    python pipeline/validate.py --fixtures   fake data  (data/fixtures)

Learn the Suomi NPP to MODIS ratios on 2012 to 2019 only. Apply them to MODIS for
2020 to 2025. Compare the estimate with what Suomi NPP really reported, per country,
for monthly totals and for yearly totals.

The error is the median absolute percentage error, as a fraction: 0.12 means the
typical total is 12% away from what Suomi NPP reported. "Raw" is the MODIS count
with nothing done to it.

Prints the tables for docs/METHOD.md and writes the headline numbers into
harmonization.json. build.py also calls evaluate(), so a rebuild keeps them.
"""
import argparse
import json
from statistics import median

import duckdb

import config
import harmonize

TRAIN_YEARS = [2012, 2019]
TEST_YEARS = [2020, 2025]
TRAIN_FROM_YM = harmonize.OVERLAP_FROM_YM       # 201202, the first full Suomi NPP month
TRAIN_TO_YM = TRAIN_YEARS[1] * 100 + 12
TEST_FROM_YM = TEST_YEARS[0] * 100 + 1
TEST_TO_YM = TEST_YEARS[1] * 100 + 12

# A total with fewer Suomi NPP detections than this is left out of the error, because a
# percentage of a handful of detections is noise (a winter month with 3 hot spots).
MIN_TOTAL = 20

METRIC = (
    f"median absolute percentage error of monthly totals per country, "
    f"{TEST_YEARS[0]} to {TEST_YEARS[1]}, ratios learned on {TRAIN_YEARS[0]} to {TRAIN_YEARS[1]}"
)


def _errors(rows):
    """rows are (modis, estimate, snpp). Returns (raw error, harmonized error, how many rows counted)."""
    used = [(m, e, s) for m, e, s in rows if s >= MIN_TOTAL]
    if not used:
        return None, None, 0
    raw = median(abs(m - s) / s for m, e, s in used)
    harmonized = median(abs(e - s) / s for m, e, s in used)
    return raw, harmonized, len(used)


def evaluate(con):
    """Run the validation on the table grid_counts in `con`.

    Returns None when the data has no training months or no test months. Otherwise a dict with
    train_years, test_years, validation (the three fields for harmonization.json),
    by_country and by_year (the tables for docs/METHOD.md).

    Leaves ratio tables learned on the training years in `con`.
    """
    have_train, have_test = con.execute(
        f"""
        SELECT
            count(*) FILTER (WHERE year * 100 + month BETWEEN {TRAIN_FROM_YM} AND {TRAIN_TO_YM}
                             AND modis_count > 0 AND snpp_count > 0),
            count(*) FILTER (WHERE year * 100 + month BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}
                             AND snpp_count > 0)
        FROM grid_counts
        """
    ).fetchone()
    if not have_train or not have_test:
        return None

    harmonize.learn_ratios(con, TRAIN_FROM_YM, TRAIN_TO_YM)
    monthly = con.execute(
        f"""
        SELECT
            g.country, g.year, g.month,
            sum(g.modis_count) AS modis,
            sum(g.modis_count * {harmonize.RATIO_SQL}) AS estimate,
            sum(g.snpp_count) AS snpp
        FROM grid_counts g
        {harmonize.RATIO_JOINS}
        WHERE g.year * 100 + g.month BETWEEN {TEST_FROM_YM} AND {TEST_TO_YM}
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3
        """
    ).fetchall()

    yearly = {}
    for country, year, month, modis, estimate, snpp in monthly:
        total = yearly.setdefault((country, year), [0, 0.0, 0])
        total[0] += modis
        total[1] += estimate
        total[2] += snpp

    raw_error, harmonized_error, n_months = _errors([row[3:] for row in monthly])
    if n_months == 0:
        return None

    by_country = []
    for country in sorted({row[0] for row in monthly}):
        m_raw, m_harm, m_n = _errors([row[3:] for row in monthly if row[0] == country])
        y_raw, y_harm, y_n = _errors([tuple(v) for (c, _), v in yearly.items() if c == country])
        by_country.append({
            "country": country,
            "monthly_raw": m_raw, "monthly_harmonized": m_harm, "months": m_n,
            "yearly_raw": y_raw, "yearly_harmonized": y_harm, "years": y_n,
        })

    by_year = [
        {"country": country, "year": year, "modis": modis, "estimate": estimate, "snpp": snpp}
        for (country, year), (modis, estimate, snpp) in sorted(yearly.items())
    ]

    return {
        "train_years": TRAIN_YEARS,
        "test_years": TEST_YEARS,
        "validation": {
            "metric": METRIC,
            "raw_error": round(raw_error, 4),
            "harmonized_error": round(harmonized_error, 4),
        },
        "months_counted": n_months,
        "by_country": by_country,
        "by_year": by_year,
    }


def _pct(value):
    return "n/a" if value is None else f"{value * 100:.1f}%"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fixtures", action="store_true", help="validate on the small fake data set")
    args = parser.parse_args()
    out_dir = config.FIXTURES_DIR if args.fixtures else config.PROCESSED_DIR

    con = duckdb.connect()
    con.execute(f"CREATE TABLE grid_counts AS SELECT * FROM read_parquet('{(out_dir / 'grid_counts.parquet').as_posix()}')")
    result = evaluate(con)
    if result is None:
        print(f"Cannot validate: {out_dir} needs months in {TRAIN_YEARS[0]} to {TRAIN_YEARS[1]} "
              f"and in {TEST_YEARS[0]} to {TEST_YEARS[1]} with both MODIS and Suomi NPP.")
        raise SystemExit(1)

    v = result["validation"]
    print(f"Data: {out_dir}")
    print(f"Learned on {TRAIN_YEARS[0]} to {TRAIN_YEARS[1]}, tested on {TEST_YEARS[0]} to {TEST_YEARS[1]}.")
    print(f"Totals with fewer than {MIN_TOTAL} Suomi NPP detections are left out.")
    print()
    print(f"Monthly totals, all countries ({result['months_counted']} months):")
    print(f"  raw MODIS error        {_pct(v['raw_error'])}")
    print(f"  harmonized error       {_pct(v['harmonized_error'])}")
    print()
    print("| Country | Monthly, raw | Monthly, harmonized | Months | Yearly, raw | Yearly, harmonized | Years |")
    print("|---|---|---|---|---|---|---|")
    for row in result["by_country"]:
        print(f"| {row['country']} | {_pct(row['monthly_raw'])} | {_pct(row['monthly_harmonized'])} | {row['months']} "
              f"| {_pct(row['yearly_raw'])} | {_pct(row['yearly_harmonized'])} | {row['years']} |")
    print()
    print("| Country | Year | MODIS, raw | Harmonized estimate | Suomi NPP, observed | Estimate vs observed |")
    print("|---|---|---|---|---|---|")
    for row in result["by_year"]:
        diff = "n/a" if row["snpp"] == 0 else f"{(row['estimate'] - row['snpp']) / row['snpp'] * 100:+.1f}%"
        print(f"| {row['country']} | {row['year']} | {row['modis']:,d} | {row['estimate']:,.0f} | {row['snpp']:,d} | {diff} |")

    path = out_dir / "harmonization.json"
    summary = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    if summary and summary.get("method") != "ratio":
        print()
        print(f"{path.name} was built with method \"{summary.get('method')}\", so it is left alone. "
              "The numbers above are for the ratio method.")
    elif summary:
        summary["train_years"] = result["train_years"]
        summary["test_years"] = result["test_years"]
        summary["validation"] = v
        path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print()
        print(f"Wrote the headline numbers into {path}")


if __name__ == "__main__":
    main()
