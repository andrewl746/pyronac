"""Download the processed data into data/processed, where the backend looks for it.

The data is a zip attached to a GitHub release of the repo; its address is in data_url.txt.
"""
import shutil
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
url = (HERE / "data_url.txt").read_text().split()[0]  # line 2 is the data hash
target = HERE / "data" / "processed"
archive = HERE / "processed.zip"

with urllib.request.urlopen(url) as response, open(archive, "wb") as out:
    shutil.copyfileobj(response, out)
with zipfile.ZipFile(archive) as z:
    z.extractall(target)
archive.unlink()

assert (target / "grid.parquet").exists(), "grid.parquet is missing from the data zip"
print(f"Data from {url} is in {target}")
