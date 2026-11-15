import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

// A thin, cool atmospheric rim around the globe, drawn behind the (transparent) map canvas so only
// the part outside the globe shows. MapLibre's own atmosphere is lit by a sun and washes the night
// side, so it is turned off in basemap.ts. Decoration only.

// The radius on screen of the globe's outline. MapLibre sizes the globe so the map centre has the
// flat map's scale (getGlobeRadiusPixels), and views it through a perspective camera whose distance
// to the centre point follows from the field of view; a sphere seen from there looks smaller than
// its radius.
function globeRadius(map: MapLibreMap): number {
  const worldSize = 512 * 2 ** map.getZoom();
  const lat = Math.min(Math.abs(map.getCenter().lat), 85.051129);
  const radius = worldSize / (2 * Math.PI) / Math.cos((lat * Math.PI) / 180);
  const fov = (map.getVerticalFieldOfView() * Math.PI) / 180;
  const camera = map.getContainer().clientHeight / 2 / Math.tan(fov / 2);
  const toCentre = camera + radius;
  return (camera * radius) / Math.sqrt(toCentre * toCentre - radius * radius);
}

export default function GlobeRim({ map }: { map: MapLibreMap | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!map || !el) return;
    const update = () => {
      // The rim assumes the globe sits square in the middle of the view; tilted, it hides.
      const flat = map.getPitch() < 1 && map.getZoom() < 6;
      el.style.opacity = flat ? "1" : "0";
      if (!flat) return;
      const r = globeRadius(map);
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      el.style.width = `${2 * r}px`;
      el.style.height = `${2 * r}px`;
      el.style.transform = `translate(${w / 2 - r}px, ${h / 2 - r}px)`;
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map]);

  return <div ref={ref} aria-hidden="true" className="pyronac-rim" style={{ opacity: 0 }} />;
}
