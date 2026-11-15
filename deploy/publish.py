"""Put Pyronac live on Fly.io, on one small server that never sleeps (about $7 a month).

Once, in your own terminal: install flyctl (https://fly.io/docs/flyctl/install/) and run
    fly auth login

Then, from the repo root:
    .venv/Scripts/python.exe deploy/publish.py              # data (if changed), then the app
    .venv/Scripts/python.exe deploy/publish.py --stage      # only build deploy/build, upload nothing
    .venv/Scripts/python.exe deploy/publish.py --app NAME   # a different Fly app name

The data (data/processed, about 900 MB) goes up as processed.zip on the GitHub release
"live-data" of this repo, and the server downloads it when it is built. The live site is
https://<app>.fly.dev
"""
import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "build"
DATA_ZIP = STAGE.parent / "data-zip" / "processed.zip"
REPO = "andrewl746/pyronac"
DATA_TAG = "live-data"
DATA_URL = f"https://github.com/{REPO}/releases/download/{DATA_TAG}/processed.zip"


def run(*args, **kwargs):
    print(">", " ".join(str(a) for a in args))
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def flyctl():
    for name in ("fly", "flyctl"):
        if found := shutil.which(name):
            return found
    default = Path.home() / ".fly" / "bin" / "flyctl.exe"
    if default.exists():
        return str(default)
    sys.exit("flyctl is not installed: see https://fly.io/docs/flyctl/install/")


def build_frontend():
    local = ROOT / "frontend" / ".env.local"
    if local.exists() and "VITE_USE_MOCKS=1" in local.read_text():
        sys.exit("frontend/.env.local has VITE_USE_MOCKS=1: the live site would show fake data")
    # VITE_API_BASE stays empty: the server serves the API from the same address.
    env = {k: v for k, v in os.environ.items() if not k.startswith("VITE_")}
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    run(npm, "run", "build", cwd=ROOT / "frontend", env=env)


def zip_data(processed):
    """Zip data/processed and return its hash. Parquet is compressed already, so store as is."""
    DATA_ZIP.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(DATA_ZIP, "w", zipfile.ZIP_STORED) as z:
        for path in sorted(processed.rglob("*")):
            if path.is_file():
                info = zipfile.ZipInfo(path.relative_to(processed).as_posix())  # fixed date: same data, same hash
                with open(path, "rb") as f:
                    z.writestr(info, f.read())
    digest = hashlib.sha256()
    with open(DATA_ZIP, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()[:16]


def upload_data(digest):
    marker = DATA_ZIP.parent / "uploaded.txt"
    if marker.exists() and marker.read_text().strip() == digest:
        print("Data unchanged since the last upload")
        return
    exists = subprocess.run(["gh", "release", "view", DATA_TAG, "-R", REPO], capture_output=True).returncode == 0
    if not exists:
        run("gh", "release", "create", DATA_TAG, "-R", REPO, "--latest=false",
            "--title", "Data for the live site",
            "--notes", "data/processed for the live site, used by deploy/publish.py. Not a release of the app.")
    run("gh", "release", "upload", DATA_TAG, DATA_ZIP, "-R", REPO, "--clobber")
    marker.write_text(digest + "\n")


def stage(app, digest):
    if STAGE.exists():
        shutil.rmtree(STAGE)
    shutil.copytree(ROOT / "deploy" / "server", STAGE)
    shutil.copytree(ROOT / "backend" / "app", STAGE / "backend" / "app",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    shutil.copytree(ROOT / "frontend" / "dist", STAGE / "frontend" / "dist")
    # The hash on the second line makes the server fetch the data again when it changes.
    (STAGE / "data_url.txt").write_text(f"{DATA_URL}\n{digest}\n")
    toml = STAGE / "fly.toml"
    toml.write_text(toml.read_text().replace("APP_NAME", app))
    print(f"Staged the server in {STAGE}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", action="store_true", help="build deploy/build only, upload nothing")
    parser.add_argument("--app", default="pyronac", help="Fly app name, also the address <app>.fly.dev")
    args = parser.parse_args()

    processed = ROOT / "data" / "processed"
    if not (processed / "grid.parquet").exists():
        sys.exit("data/processed/grid.parquet is missing: run the pipeline first")

    fly = None if args.stage else flyctl()
    build_frontend()
    print("Zipping data/processed ...")
    digest = zip_data(processed)

    if args.stage:
        stage(args.app, digest)
        return

    upload_data(digest)
    stage(args.app, digest)
    if subprocess.run([fly, "status", "-a", args.app], capture_output=True).returncode != 0:
        run(fly, "apps", "create", args.app, "--org", "personal")  # every account has this org
    # One machine only (--ha=false), so it costs one machine.
    run(fly, "deploy", "--remote-only", "--ha=false", cwd=STAGE)
    print(f"Live: https://{args.app}.fly.dev")


if __name__ == "__main__":
    main()
