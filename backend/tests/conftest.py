"""Tests always run on the fake fixtures."""
import os
from pathlib import Path

import pytest

os.environ["FIRE_DATA_DIR"] = str(Path(__file__).resolve().parents[2] / "data" / "fixtures")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

# The fixture box: every fake detection is inside it.
BOX = {"west": -116.0, "south": 61.0, "east": -114.0, "north": 63.0}


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def box():
    return dict(BOX)
