"""One read-only DuckDB connection over the Parquet files.

Every router gets its data through query() or stream(). Do not open other connections.
Copied from MASTERSPEC.md Appendix A. Change only with team agreement.

Two views are available to SQL:

grid    one row per 0.1 degree cell and month. Columns:
        cell_x, cell_y, year, month, country,
        modis_count, snpp_count, noaa20_count,
        modis_frp_sum, snpp_frp_sum, noaa20_frp_sum,
        harmonized_count,
        ym           year * 100 + month
        raw_count    what a naive user would count: MODIS, then S-NPP, then NOAA-20
        viirs_count  the VIIRS count of that era, NULL before 2012-02

points  one row per detection. Columns:
        latitude, longitude, acq_date, acq_time, sensor, satellite, confidence,
        frp, daynight, country, cell_x, cell_y, year, month
"""
import json
import threading

import duckdb

from . import config

_lock = threading.Lock()
_con = None


def _connect():
    folder = config.data_dir().as_posix()
    con = duckdb.connect()
    con.execute(
        f"""
        CREATE VIEW grid AS
        SELECT
            *,
            year * 100 + month AS ym,
            CASE
                WHEN year * 100 + month <= {config.MODIS_ERA_END_YM} THEN modis_count
                WHEN year * 100 + month <= {config.SNPP_ERA_END_YM} THEN snpp_count
                ELSE noaa20_count
            END AS raw_count,
            CASE
                WHEN year * 100 + month <= {config.MODIS_ERA_END_YM} THEN NULL
                WHEN year * 100 + month <= {config.SNPP_ERA_END_YM} THEN snpp_count
                ELSE noaa20_count
            END AS viirs_count
        FROM read_parquet('{folder}/grid.parquet')
        """
    )
    con.execute(
        f"""
        CREATE VIEW points AS
        SELECT * FROM read_parquet('{folder}/points/*/*.parquet', hive_partitioning = true)
        """
    )
    return con


def _connection():
    global _con
    if _con is None:
        _con = _connect()
    return _con


def query(sql, params=None):
    """Run a query and return a list of dicts, one per row.

    Use ? placeholders and pass values in params. Never build SQL from user input.
    """
    with _lock:
        result = _connection().execute(sql, params or [])
        names = [column[0] for column in result.description]
        return [dict(zip(names, row)) for row in result.fetchall()]


def stream(sql, params=None, batch=50_000):
    """Yield rows as tuples, a batch at a time. For big CSV exports."""
    with _lock:
        cursor = _connection().cursor()
    cursor.execute(sql, params or [])
    while True:
        rows = cursor.fetchmany(batch)
        if not rows:
            break
        yield from rows


def harmonization():
    """The contents of harmonization.json, written by the pipeline."""
    return json.loads((config.data_dir() / "harmonization.json").read_text(encoding="utf-8"))
