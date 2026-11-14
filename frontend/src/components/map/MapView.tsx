import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { BASEMAP } from "./basemap";
import "./map.css";

// The opening view from MASTERSPEC.md section 8: the globe, centred over Canada.
const START = { center: [-100, 55] as [number, number], zoom: 1.8 };

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: BASEMAP,
      center: START.center,
      zoom: START.zoom,
      minZoom: 0.5,
      maxZoom: 16,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("style.load", () => {
      map.setProjection({ type: "globe" });
      setMap(map);
    });
    return () => {
      setMap(null);
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="pyronac-map" />;
}
