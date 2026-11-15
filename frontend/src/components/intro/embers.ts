// The fire on the opening screen: one region and one season, drawn at the record's finest grain
// (0.1 degree cells) as small patches of light, the way the night lights of cities show on the
// same globe. The app's own country-wide glow is hidden while the opening screen is up, because
// from orbit it reads as one cloud over Canada rather than as fires.
import type { Feature, FeatureCollection, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Bbox, GridResponse } from "../../api/types";
import { rampColor, scaleValue } from "../../lib/colors";
import { FIRST_LABEL_LAYER } from "../map/basemap";
import { FIRE_LAYER_IDS } from "../map/fire";
import { cellRadius } from "../map/glow";

const SOURCE = "intro-embers";
const LAYER_BLOOM = "intro-embers-bloom";
const LAYER_DOTS = "intro-embers-dots";

// The place names are hidden with the app's panels: the caption says where this is.
const LABEL_LAYERS = ["label-country", "label-province", "label-town", "label-city"];

// Where the faintest cell starts on the Fire ramp: past its purples, at ember red.
const RAMP_FLOOR = 0.42;
// Colour climbs the ramp slowly at first, so most cells are ember orange and only the busiest
// reach yellow and white (the same idea as COLOR_CURVE in map/fire.ts).
const COLOR_CURVE = 1.7;
// Cells this close to the region's edge fade out, so the region does not end in a straight cut.
const FADE_DEGREES = 0.9;

type EmberProperties = { color: string; opacity: number; glow: number };

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function embers(grid: GridResponse, bbox: Bbox): FeatureCollection<Point, EmberProperties> {
  const deg = grid.step / 10;
  return {
    type: "FeatureCollection",
    features: grid.cells.map(([x, y, value]): Feature<Point, EmberProperties> => {
      const lon = (x + 0.5) * deg;
      const lat = (y + 0.5) * deg;
      const t = scaleValue(value, grid.max);
      const edge = Math.min(lon - bbox.west, bbox.east - lon, lat - bbox.south, bbox.north - lat);
      const fade = Math.min(1, Math.max(0, edge / FADE_DEGREES));
      return {
        type: "Feature",
        properties: {
          color: rampColor(RAMP_FLOOR + (1 - RAMP_FLOOR) * t ** COLOR_CURVE, "fire"),
          opacity: (0.55 + 0.45 * t) * fade,
          glow: (0.03 + 0.07 * t) * fade,
        },
        geometry: { type: "Point", coordinates: [lon, lat] },
      };
    }),
  };
}

// Hides the app's fire layers and the place names, and adds the (empty) ember layers.
// The points face the viewer, so they stay round under the tilted camera, like lights. At this
// tilt and latitude the rows of cells are about as far apart on screen as the cells in a row.
// Each point reaches almost a whole cell and is soft at its edge, so the cells of one fire run
// together into its shape and the grid does not show.
export function showEmbers(map: MapLibreMap): void {
  for (const id of [...FIRE_LAYER_IDS, ...LABEL_LAYERS]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
  }
  if (map.getSource(SOURCE)) return;
  map.addSource(SOURCE, { type: "geojson", data: EMPTY });
  map.addLayer(
    {
      id: LAYER_BLOOM,
      type: "circle",
      source: SOURCE,
      paint: {
        "circle-color": "#ff5a1f",
        "circle-opacity": ["get", "glow"],
        "circle-radius": cellRadius(1, 2.6),
        "circle-blur": 1,
        "circle-pitch-alignment": "viewport",
        "circle-pitch-scale": "map",
      },
    },
    FIRST_LABEL_LAYER,
  );
  map.addLayer(
    {
      id: LAYER_DOTS,
      type: "circle",
      source: SOURCE,
      paint: {
        "circle-color": ["get", "color"],
        "circle-opacity": ["get", "opacity"],
        "circle-radius": cellRadius(1, 0.95),
        "circle-blur": 0.75,
        "circle-pitch-alignment": "viewport",
        "circle-pitch-scale": "map",
      },
    },
    FIRST_LABEL_LAYER,
  );
}

export function setEmbers(map: MapLibreMap, grid: GridResponse | undefined, bbox: Bbox): void {
  map.getSource<GeoJSONSource>(SOURCE)?.setData(grid ? embers(grid, bbox) : EMPTY);
}

// Removes the ember layers and shows the place names and the app's fire layers again (the app
// opens in its hot spots view).
export function hideEmbers(map: MapLibreMap): void {
  try {
    for (const id of [LAYER_DOTS, LAYER_BLOOM]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    for (const id of [...FIRE_LAYER_IDS, ...LABEL_LAYERS]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }
  } catch {
    // The map was already removed with the page.
  }
}
