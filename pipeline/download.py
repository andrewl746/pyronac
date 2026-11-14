"""Download public yearly FIRMS country CSVs (MASTERSPEC.md section 5.1).

Run from the repo root, for example:
    python pipeline/download.py --country canada --years 2023 --sources modis,viirs-snpp
    python pipeline/download.py --country canada --years 2003-2025 --sources modis,viirs-snpp
    python pipeline/download.py --country canada --years 2018-2025 --sources viirs-jpss1

Year 2026 requires the separate authenticated archive request in section 5.1.
"""
import argparse
import csv
import sys
import time

import httpx

import config


def parse_years(value):
    try:
        parts = value.split("-")
        if len(parts) not in (1, 2):
            raise ValueError
        start = int(parts[0])
        end = int(parts[-1])
        if not 2003 <= start <= end <= 2025:
            raise ValueError
    except ValueError:
        raise argparse.ArgumentTypeError(
            "Use a year or range within 2003-2025, e.g. 2023 or 2003-2025. "
            "2026 needs a FIRMS archive request."
        ) from None
    return range(start, end + 1)


def parse_sources(value):
    sources = list(dict.fromkeys(part.strip() for part in value.split(",")))
    if not sources or any(source not in config.SOURCES for source in sources):
        raise argparse.ArgumentTypeError("Sources must be comma-separated: " + ",".join(config.SOURCES))
    return sources


def download_one(client, country, source, year):
    name = f"{source}_{year}_{config.COUNTRIES[country]}.csv"
    target = config.RAW_DIR / source / name
    if target.exists() and target.stat().st_size > 0:
        print(f"SKIP {target.relative_to(config.ROOT)} ({target.stat().st_size:,} bytes)", flush=True)
        return False

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".csv.part")
    url = f"{config.FIRMS_COUNTRY_BASE}/{source}/{year}/{name}"
    for attempt in range(1, 4):
        try:
            print(f"GET  {url} (attempt {attempt}/3)", flush=True)
            with client.stream("GET", url) as response:
                response.raise_for_status()
                with temporary.open("wb") as handle:
                    for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                        handle.write(chunk)
            size = temporary.stat().st_size
            if size == 0:
                raise ValueError("NASA returned an empty file")
            with temporary.open(encoding="utf-8-sig", newline="") as handle:
                header = next(csv.reader(handle), [])
            required = {"latitude", "longitude", "acq_date", "acq_time", "confidence", "frp"}
            if not required.issubset(header):
                raise ValueError("Response is not a FIRMS CSV: required header columns are missing")
            temporary.replace(target)
            print(f"SAVED {target.relative_to(config.ROOT)} ({size:,} bytes, {size / 1e6:.2f} MB)", flush=True)
            return True
        except (httpx.HTTPError, OSError, ValueError, UnicodeError) as error:
            temporary.unlink(missing_ok=True)
            retryable = not isinstance(error, httpx.HTTPStatusError) or error.response.status_code in (
                408, 429, 500, 502, 503, 504
            )
            if attempt == 3 or not retryable:
                raise
            print(f"RETRY {name}: {error}", file=sys.stderr, flush=True)
            time.sleep(attempt * 2)
    return False


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--country", type=str.lower, choices=config.COUNTRIES, default="canada")
    parser.add_argument("--years", type=parse_years, default=parse_years("2003-2025"))
    parser.add_argument("--sources", type=parse_sources, default=list(config.SOURCES))
    args = parser.parse_args()
    downloaded = skipped = 0
    failed = []
    with httpx.Client(timeout=600.0, follow_redirects=True) as client:
        for source in args.sources:
            info = config.SOURCES[source]
            for year in args.years:
                if not info["first_year"] <= year <= info["last_year"]:
                    continue
                try:
                    if download_one(client, args.country, source, year):
                        downloaded += 1
                    else:
                        skipped += 1
                except (httpx.HTTPError, OSError, ValueError, UnicodeError) as error:
                    failed.append((source, year))
                    print(f"FAILED {source} {year} {args.country}: {error}", file=sys.stderr, flush=True)
    print(f"Finished: {downloaded} downloaded, {skipped} already present, {len(failed)} failed.", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
