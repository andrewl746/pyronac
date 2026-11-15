// The base map: Earth at night, with country and province borders and place names on top.
// All free, no key.
//   Imagery: NASA Black Marble 2016 (VIIRS night lights), served by NASA GIBS. Public domain,
//   credited in the attribution.
//   Borders and labels: OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data).
// This replaces the dark vector style named in MASTERSPEC.md section 8: the night side of Earth,
// where fires read as lights, by Yuvi's choice in the UI refresh.
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];
const LABEL_COLOR = "rgba(190, 202, 218, 0.3)";
const LABEL_HALO = "rgba(3, 5, 8, 0.55)";
const PLACE_COLOR = "rgba(214, 222, 232, 0.62)"; // towns and cities, seen only zoomed in

// The fire layers go underneath this layer, so place names stay readable on top of them.
export const FIRST_LABEL_LAYER = "label-country";

export const BASEMAP: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  // No MapLibre atmosphere: it is lit by a sun, so it washes the night side and browns the limb.
  // A thin cool rim is drawn behind the map instead (GlobeRim.tsx). The sky is transparent so the
  // star field behind the map shows through.
  sky: {
    "sky-color": "rgba(0, 0, 0, 0)",
    "horizon-color": "rgba(0, 0, 0, 0)",
    "fog-color": "rgba(0, 0, 0, 0)",
    "atmosphere-blend": 0,
  },
  light: { anchor: "map", position: [1.5, 90, 80] },
  sources: {
    night: {
      type: "raster",
      tiles: [
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
      ],
      tileSize: 256,
      maxzoom: 8,
      attribution:
        '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">NASA Black Marble 2016 via GIBS</a>',
    },
    openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    // Shows as deep night ocean until the imagery arrives.
    { id: "background", type: "background", paint: { "background-color": "#04060a" } },
    {
      id: "night",
      type: "raster",
      source: "night",
      // Black Marble shows moonlit land and a navy sea. Kept a little cool and dim so the land reads
      // as dark slate; the sea is darkened further by the water layer below, so the continents
      // stand out without a daytime wash, and the city lights stay the brightest thing.
      paint: {
        "raster-brightness-max": 0.78,
        "raster-saturation": -0.35,
        "raster-contrast": 0.12,
        "raster-fade-duration": 300,
      },
    },
    // Oceans, seas and lakes pushed close to black, so the land shows as dark slate.
    {
      id: "water-dark",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#010307", "fill-opacity": 0.72 },
    },
    {
      id: "border-province",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      minzoom: 3,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!", ["to-boolean", ["get", "maritime"]]]],
      paint: {
        "line-color": "rgba(150, 170, 196, 0.1)",
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
        "line-color": "rgba(150, 170, 196, 0.16)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 5, 0.9, 10, 1.4],
      },
    },
    {
      id: "label-country",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      maxzoom: 8,
      // Only the larger countries, so the globe is not crowded with names.
      filter: ["all", ["==", ["get", "class"], "country"], ["<=", ["get", "rank"], 1]],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 8.5, 4, 10.5, 7, 13],
        "text-max-width": 7,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.18,
        "text-padding": 12,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": LABEL_COLOR, "text-halo-color": LABEL_HALO, "text-halo-width": 1 },
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
      paint: { "text-color": "rgba(190, 200, 212, 0.45)", "text-halo-color": LABEL_HALO, "text-halo-width": 1.2 },
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
      paint: { "text-color": PLACE_COLOR, "text-halo-color": LABEL_HALO, "text-halo-width": 1 },
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
      paint: { "text-color": PLACE_COLOR, "text-halo-color": LABEL_HALO, "text-halo-width": 1 },
    },
  ],
};
