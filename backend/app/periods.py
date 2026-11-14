"""The three month values every endpoint needs, computed one way (MASTERSPEC section 7).

data_through         the data_through date in harmonization.json
last_month           the month data_through falls in
last_complete_month  the latest complete month

A month is complete if it is before last_month, or it is last_month and
data_through is the last day of that month. Months are (year, month) pairs.
"""
import calendar
import re
from datetime import date

from . import db

_MONTH = re.compile(r"^(\d{4})-(\d{2})$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def data_through() -> date:
    return date.fromisoformat(db.harmonization()["data_through"])


def last_month() -> tuple[int, int]:
    day = data_through()
    return day.year, day.month


def is_complete(year: int, month: int) -> bool:
    day = data_through()
    if (year, month) != (day.year, day.month):
        return (year, month) < (day.year, day.month)
    return day.day == calendar.monthrange(year, month)[1]


def last_complete_month() -> tuple[int, int]:
    year, month = last_month()
    if is_complete(year, month):
        return year, month
    return (year, month - 1) if month > 1 else (year - 1, 12)


def month_string(year: int, month: int) -> str:
    """(2026, 11) -> "2026-11"."""
    return f"{year:04d}-{month:02d}"


def parse_month(text: str) -> tuple[int, int] | None:
    """ "2023-07" -> (2023, 7). None when it is not a valid month."""
    match = _MONTH.match(text)
    if not match:
        return None
    year, month = int(match.group(1)), int(match.group(2))
    return (year, month) if 1 <= month <= 12 else None


def parse_date(text: str) -> date | None:
    """ "2023-07-31" -> a date. None when it is not a valid date."""
    if not _DATE.match(text):
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None
