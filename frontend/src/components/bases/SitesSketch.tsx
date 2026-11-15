// The fallback picture for the printed list, used only when the map's own picture comes out
// blank: the sites and their reach circles on a plain latitude and longitude grid.
import { circleRing, circlesBounds } from "./geo";
import type { BaseSite } from "./types";

const WIDTH = 680;
const PAD = 28;

export function SitesSketch({ sites, km }: { sites: BaseSite[]; km: number }) {
  const bounds = circlesBounds(sites, km);
  if (!bounds) return null;
  const [[west, south], [east, north]] = bounds;
  // Longitude squeezed by the cosine of the middle latitude, so shapes look about right.
  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = (WIDTH - 2 * PAD) / Math.max((east - west) * squeeze, 1e-6);
  const height = Math.round((north - south) * scale + 2 * PAD);
  const x = (lon: number) => PAD + (lon - west) * squeeze * scale;
  const y = (lat: number) => PAD + (north - lat) * scale;
  const ring = (site: BaseSite) =>
    circleRing(site.lat, site.lon, km)
      .map(([lon, lat], i) => `${i ? "L" : "M"}${x(lon).toFixed(1)},${y(lat).toFixed(1)}`)
      .join("") + "Z";

  const lats: number[] = [];
  for (let lat = Math.ceil(south / 5) * 5; lat <= north; lat += 5) lats.push(lat);
  const lons: number[] = [];
  for (let lon = Math.ceil(west / 10) * 10; lon <= east; lon += 10) lons.push(lon);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      role="img"
      aria-label={`Sketch of ${sites.length} candidate sites and their ${km} km reach circles on a latitude and longitude grid`}
      style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
    >
      <g stroke="var(--border)" strokeWidth={0.75}>
        {lats.map((lat) => (
          <line key={`lat${lat}`} x1={PAD} x2={WIDTH - PAD} y1={y(lat)} y2={y(lat)} />
        ))}
        {lons.map((lon) => (
          <line key={`lon${lon}`} x1={x(lon)} x2={x(lon)} y1={PAD} y2={height - PAD} />
        ))}
      </g>
      <g fill="var(--text-dim)" fontSize={10}>
        {lats.map((lat) => (
          <text key={`tlat${lat}`} x={4} y={y(lat) + 3}>
            {lat}°N
          </text>
        ))}
        {lons.map((lon) => (
          <text key={`tlon${lon}`} x={x(lon)} y={height - 8} textAnchor="middle">
            {Math.abs(lon)}°W
          </text>
        ))}
      </g>
      <g fill="var(--text-dim)" fillOpacity={0.06} stroke="var(--text)" strokeWidth={1}>
        {sites.map((site) => (
          <path key={site.rank} d={ring(site)} />
        ))}
      </g>
      {[...sites].reverse().map((site) => (
        <g key={site.rank}>
          <circle cx={x(site.lon)} cy={y(site.lat)} r={8} fill="var(--text)" />
          <text x={x(site.lon)} y={y(site.lat) + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--panel)">
            {site.rank}
          </text>
        </g>
      ))}
    </svg>
  );
}
