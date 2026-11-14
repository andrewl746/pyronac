"""Turn raw FIRMS CSV files into the tables the backend reads.

Usage, from the repo root:
    python pipeline/build.py --fixtures     fake data  -> data/fixtures
    python pipeline/build.py                real data  -> data/processed

Reads   <raw>/<source>/<source>_<year>_<Country>.csv
        where source is modis, viirs-snpp or viirs-jpss1
Writes  <out>/points/year=YYYY/*.parquet
        <out>/grid_counts.parquet
        <out>/grid.parquet
        <out>/harmonization.json

The SQL in this file is the definition of the cleaning rules and the grid.
Copied from MASTERSPEC.md Appendix A. Change the rules only with team agreement.
"""
import argparse
import shutil

import duckdb

import config
import harmonize

CSV_TYPES = (
    "{'latitude': 'DOUBLE', 'longitude': 'DOUBLE', 'acq_date': 'DATE', 'acq_time': 'VARCHAR', "
    "'satellite': 'VARCHAR', 'confidence': 'VARCHAR', 'version': 'VARCHAR', 'frp': 'DOUBLE'}"
)

SATELLITE_SQL = {
    "modis": "CASE upper(substr(satellite, 1, 1)) WHEN 'T' THEN 'Terra' ELSE 'Aqua' END",
    "viirs-snpp": "'SNPP'",
    "viirs-jpss1": "'NOAA20'",
}
MODIS_CONFIDENCE = "CASE WHEN TRY_CAST(confidence AS INTEGER) >= 80 THEN 'high' ELSE 'nominal' END"
MODIS_KEEP = f"TRY_CAST(confidence AS INTEGER) >= {config.MODIS_MIN_CONFIDENCE}"
VIIRS_CONFIDENCE = "CASE lower(substr(confidence, 1, 1)) WHEN 'h' THEN 'high' ELSE 'nominal' END"
VIIRS_KEEP = "lower(substr(confidence, 1, 1)) IN ('n', 'h')"

# Near-real-time files have no "type" column, so rule 2 cannot drop their non-fire sources (gas flares,
# industry). Their detections are dropped at small spots that the labelled VIIRS files mark as non-fire.
# Tested on 2025 as if unlabelled: October goes from 21.5% too high to 0.0%, and 0.05% of real fires are dropped.
STATIC_SPOT = 0.005       # degrees, the size of a spot
STATIC_MIN_NONFIRE = 3    # labelled non-fire detections a spot needs, and they must be at least half of its detections
UNLABELLED_STATIC = (
    '"type" IS NULL AND EXISTS (SELECT 1 FROM static_spots s '
    f"WHERE s.a = floor(latitude / {STATIC_SPOT}) AND s.b = floor(longitude / {STATIC_SPOT}))"
)


def load_clean(con, raw_dir):
    """Read every raw file into one table, applying the cleaning rules."""
    con.execute(
        """
        CREATE OR REPLACE TABLE clean (
            latitude DOUBLE, longitude DOUBLE, acq_date DATE, acq_time VARCHAR,
            sensor VARCHAR, satellite VARCHAR, confidence VARCHAR, frp DOUBLE, daynight VARCHAR,
            country VARCHAR, cell_x INTEGER, cell_y INTEGER, year INTEGER, month INTEGER
        )
        """
    )
    labelled = [
        f"""SELECT latitude, longitude, "type" FROM read_csv('{(raw_dir / s).as_posix()}/*.csv', header = true,
                    union_by_name = true, types = {CSV_TYPES})
            WHERE "type" IS NOT NULL AND {VIIRS_KEEP}"""
        for s in ("viirs-snpp", "viirs-jpss1") if list((raw_dir / s).glob("*.csv"))
    ]
    con.execute(
        f"""
        CREATE OR REPLACE TABLE static_spots AS
        SELECT floor(latitude / {STATIC_SPOT}) AS a, floor(longitude / {STATIC_SPOT}) AS b
        FROM ({" UNION ALL ".join(labelled) if labelled else "SELECT NULL::DOUBLE AS latitude, NULL::DOUBLE AS longitude, NULL::INTEGER AS type WHERE false"})
        GROUP BY 1, 2
        HAVING count(*) FILTER (WHERE "type" <> 0) >= {STATIC_MIN_NONFIRE}
           AND count(*) FILTER (WHERE "type" <> 0) >= count(*) FILTER (WHERE "type" = 0)
        """
    )
    for source, info in config.SOURCES.items():
        folder = raw_dir / source
        if not list(folder.glob("*.csv")):
            print(f"  {source}: no files found, skipped")
            continue
        is_modis = source == "modis"
        con.execute(
            f"""
            INSERT INTO clean
            SELECT
                latitude,
                longitude,
                acq_date,
                lpad(acq_time, 4, '0'),
                '{info["sensor"]}',
                {SATELLITE_SQL[source]},
                {MODIS_CONFIDENCE if is_modis else VIIRS_CONFIDENCE},
                frp,
                upper(substr(daynight, 1, 1)),
                lower(regexp_extract(filename, '_([A-Za-z]+)[.]csv$', 1)),
                CAST(floor(round(longitude * 10, 6)) AS INTEGER),
                CAST(floor(round(latitude * 10, 6)) AS INTEGER),
                year(acq_date),
                month(acq_date)
            FROM read_csv('{folder.as_posix()}/*.csv', header = true, union_by_name = true,
                          filename = true, types = {CSV_TYPES})
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND acq_date IS NOT NULL
              AND ("type" IS NULL OR "type" = 0)
              AND NOT ({UNLABELLED_STATIC})
              AND {MODIS_KEEP if is_modis else VIIRS_KEEP}
              AND year(acq_date) * 100 + month(acq_date) >= {config.FIRST_YM}
            """
        )
        print(f"  {source}: loaded")


def write_points(con, out_dir):
    """The detections the app serves: the ones the raw record counts in each era."""
    target = out_dir / "points"
    if target.exists():
        shutil.rmtree(target)
    con.execute(
        f"""
        COPY (
            SELECT * FROM clean
            WHERE sensor = 'MODIS'
               OR (satellite = 'SNPP'
                   AND year * 100 + month > {config.MODIS_ERA_END_YM}
                   AND year * 100 + month <= {config.SNPP_ERA_END_YM})
               OR (satellite = 'NOAA20' AND year * 100 + month > {config.SNPP_ERA_END_YM})
            ORDER BY acq_date, acq_time
        ) TO '{target.as_posix()}' (FORMAT PARQUET, PARTITION_BY (year))
        """
    )


def build_grid_counts(con):
    """One row per 0.1 degree cell and month, with what each satellite saw."""
    con.execute(
        """
        CREATE OR REPLACE TABLE grid_counts AS
        SELECT
            cell_x,
            cell_y,
            year,
            month,
            min(country) AS country,
            CAST(count(*) FILTER (WHERE sensor = 'MODIS') AS INTEGER) AS modis_count,
            CAST(count(*) FILTER (WHERE satellite = 'SNPP') AS INTEGER) AS snpp_count,
            CAST(count(*) FILTER (WHERE satellite = 'NOAA20') AS INTEGER) AS noaa20_count,
            coalesce(CAST(sum(CAST(frp AS DECIMAL(18, 3))) FILTER (WHERE sensor = 'MODIS') AS DOUBLE), 0) AS modis_frp_sum,
            coalesce(CAST(sum(CAST(frp AS DECIMAL(18, 3))) FILTER (WHERE satellite = 'SNPP') AS DOUBLE), 0) AS snpp_frp_sum,
            coalesce(CAST(sum(CAST(frp AS DECIMAL(18, 3))) FILTER (WHERE satellite = 'NOAA20') AS DOUBLE), 0) AS noaa20_frp_sum
        FROM clean
        GROUP BY cell_x, cell_y, year, month
        ORDER BY cell_x, cell_y, year, month
        """
    )


def report(con):
    print("Detections kept, by satellite:")
    for satellite, n, first, last in con.execute(
        "SELECT satellite, count(*), min(acq_date), max(acq_date) FROM clean GROUP BY 1 ORDER BY 1"
    ).fetchall():
        print(f"  {satellite:7s} {n:>12,d}   {first} to {last}")
    rows, cells = con.execute("SELECT count(*), count(DISTINCT (cell_x, cell_y)) FROM grid").fetchone()
    print(f"Grid: {rows:,d} rows over {cells:,d} cells")
    bad = con.execute("SELECT count(*) FROM grid WHERE harmonized_count IS NULL OR harmonized_count < 0").fetchone()[0]
    print(f"Rows with a missing or negative harmonized_count: {bad} (must be 0)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fixtures", action="store_true", help="build the small fake data set")
    args = parser.parse_args()

    raw_dir = config.FIXTURES_DIR / "raw" if args.fixtures else config.RAW_DIR
    out_dir = config.FIXTURES_DIR if args.fixtures else config.PROCESSED_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.fixtures:
        con = duckdb.connect()  # in memory
    else:
        config.INTERIM_DIR.mkdir(parents=True, exist_ok=True)
        con = duckdb.connect(str(config.INTERIM_DIR / "work.duckdb"))  # on disk, so big data fits

    print(f"Reading raw files from {raw_dir}")
    load_clean(con, raw_dir)
    write_points(con, out_dir)
    build_grid_counts(con)
    con.execute(f"COPY grid_counts TO '{(out_dir / 'grid_counts.parquet').as_posix()}' (FORMAT PARQUET)")

    data_through = con.execute("SELECT max(acq_date) FROM clean").fetchone()[0]
    harmonize.run(con, out_dir, str(data_through))  # creates the table "grid"
    con.execute(
        f"""
        COPY (SELECT * FROM grid ORDER BY cell_x, cell_y, year, month)
        TO '{(out_dir / 'grid.parquet').as_posix()}' (FORMAT PARQUET)
        """
    )
    report(con)
    print(f"Done. Tables are in {out_dir}")


if __name__ == "__main__":
    main()
