"""GET /api/meta on the fixtures."""

META_FIELDS = {
    "app", "data_source", "first_month", "last_month", "last_complete_month",
    "data_through", "countries", "presets", "eras", "harmonization",
}
HARMONIZATION_FIELDS = {
    "method", "generated_at", "data_through", "reference", "handoff_ratio_noaa20",
    "train_years", "test_years", "validation", "notes",
}


def test_meta_fields_match_types_ts(client):
    response = client.get("/api/meta")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == META_FIELDS
    assert set(body["harmonization"]) == HARMONIZATION_FIELDS


def test_meta_months_on_fixtures(client):
    body = client.get("/api/meta").json()
    assert body["app"] == "Pyronac"
    assert body["data_source"] == "fixtures"
    assert body["first_month"] == "2003-01"
    assert body["last_month"] == "2026-11"
    assert body["last_complete_month"] == "2026-10"
    assert body["data_through"] == "2026-11-06"
    assert body["harmonization"]["data_through"] == body["data_through"]


def test_meta_countries_and_presets(client):
    body = client.get("/api/meta").json()
    assert body["countries"] == ["canada"]
    presets = body["presets"]
    assert presets[0]["id"] == "fixture"
    assert [p["id"] for p in presets] == ["fixture", "nwt", "bc", "canada"]
    for preset in presets:
        assert set(preset) == {"id", "name", "bbox"}
        assert set(preset["bbox"]) == {"west", "south", "east", "north"}


def test_meta_eras(client):
    eras = client.get("/api/meta").json()["eras"]
    assert [era["id"] for era in eras] == ["modis", "snpp", "noaa20"]
    assert eras[0]["to"] == "2012-01"
    assert eras[1]["from"] == "2012-02" and eras[1]["to"] == "2026-10"
    assert eras[2]["from"] == "2026-11" and eras[2]["to"] is None
    for era in eras:
        assert set(era) == {"id", "label", "from", "to"}
