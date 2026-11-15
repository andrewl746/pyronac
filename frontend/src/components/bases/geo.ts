// Reach circles drawn as real distances on the Earth, so they stay right at high latitude
// (a circle in degrees would be squashed east to west in the north).
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { BaseSite } from "./types";

const EARTH_KM = 6371.0088;
const STEPS = 72; // points around each circle

// The point `km` away from (lat, lon) along `bearing` degrees from north, on a sphere.
function destination(lat: number, lon: number, km: number, bearing: number): [number, number] {
  const rad = Math.PI / 180;
  const phi1 = lat * rad;
  const lambda1 = lon * rad;
  const theta = bearing * rad;
  const delta = km / EARTH_KM;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 =
    lambda1 +
    Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return [lambda2 / rad, phi2 / rad];
}

// A ring of [lon, lat] points `km` from the centre, closed (first point repeated last).
export function circleRing(lat: number, lon: number, km: number): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < STEPS; i++) ring.push(destination(lat, lon, km, (i * 360) / STEPS));
  ring.push(ring[0]);
  return ring;
}

export function circlesGeoJson(sites: BaseSite[], km: number): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: sites.map(
      (site): Feature<Polygon> => ({
        type: "Feature",
        properties: { rank: site.rank },
        geometry: { type: "Polygon", coordinates: [circleRing(site.lat, site.lon, km)] },
      }),
    ),
  };
}

export function pointsGeoJson(sites: BaseSite[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: sites.map(
      (site): Feature<Point> => ({
        type: "Feature",
        properties: { rank: site.rank },
        geometry: { type: "Point", coordinates: [site.lon, site.lat] },
      }),
    ),
  };
}

// West, south, east, north around every circle, for fitting the map to the sites.
export function circlesBounds(sites: BaseSite[], km: number): [[number, number], [number, number]] | null {
  if (sites.length === 0) return null;
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const site of sites) {
    for (const [lon, lat] of circleRing(site.lat, site.lon, km)) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return [
    [west, south],
    [east, north],
  ];
}
