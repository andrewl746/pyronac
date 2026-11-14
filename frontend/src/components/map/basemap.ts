// The base map: a cloud-free satellite mosaic of the whole Earth, with country and province
// borders, place names and ocean names on top. All free, no key.
//   Imagery: Sentinel-2 cloudless 2024 by EOX (CC BY-NC-SA 4.0, attribution required).
//   Borders and labels: OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data).
// This replaces the dark vector style named in MASTERSPEC.md section 8, by Vlad's choice.
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];
const LABEL_COLOR = "#f4f1ea";
const LABEL_HALO = "rgba(0, 0, 0, 0.8)";

// The fire layers go underneath this layer, so place names stay readable on top of them.
export const FIRST_LABEL_LAYER = "label-ocean";

export const BASEMAP: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  // A thin blue atmosphere around the globe, faded out as you zoom in.
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
  light: { anchor: "map", position: [1.5, 90, 80] },
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
      ],
      tileSize: 256,
      maxzoom: 15,
      attribution:
        '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2024</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024)',
    },
    openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    // Shows as deep ocean until the imagery arrives.
    { id: "background", type: "background", paint: { "background-color": "#0a1724" } },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      // Slightly darker than the original so the red fire marks and the white labels stand out.
      paint: { "raster-brightness-max": 0.9, "raster-contrast": 0.05, "raster-fade-duration": 200 },
    },
    {
      id: "border-province",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      minzoom: 3,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!", ["to-boolean", ["get", "maritime"]]]],
      paint: {
        "line-color": "rgba(255, 255, 255, 0.45)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 8, 1.2],
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "border-country",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!", ["to-boolean", ["get", "maritime"]]]],
      layout: { "line-join": "round" },
      paint: {
        "line-color": "rgba(255, 255, 255, 0.8)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 5, 1.2, 10, 2],
      },
    },
    {
      id: "label-ocean",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      maxzoom: 7,
      filter: ["in", ["get", "class"], ["literal", ["ocean", "sea"]]],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 5, 13],
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
      },
      paint: { "text-color": "#a9cbe8", "text-halo-color": LABEL_HALO, "text-halo-width": 1 },
    },
    {
      id: "label-country",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      maxzoom: 8,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 4, 14, 7, 18],
        "text-max-width": 7,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": LABEL_COLOR, "text-halo-color": LABEL_HALO, "text-halo-width": 1.4 },
    },
    {
      id: "label-province",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 4,
      maxzoom: 9,
      filter: ["in", ["get", "class"], ["literal", ["state", "province"]]],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 8, 14],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: { "text-color": "rgba(244, 241, 234, 0.85)", "text-halo-color": LABEL_HALO, "text-halo-width": 1.2 },
    },
    {
      id: "label-town",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 8,
      filter: ["in", ["get", "class"], ["literal", ["town", "village"]]],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 12, 13],
        "text-max-width": 8,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": LABEL_COLOR, "text-halo-color": LABEL_HALO, "text-halo-width": 1.2 },
    },
    {
      id: "label-city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 4,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 10, 15],
        "text-max-width": 8,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": LABEL_COLOR, "text-halo-color": LABEL_HALO, "text-halo-width": 1.4 },
    },
  ],
};
