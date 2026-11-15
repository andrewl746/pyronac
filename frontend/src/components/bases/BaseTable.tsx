// The first N candidate sites as a real table: the text alternative to the markers on the map.
import { formatCount } from "../../lib/format";
import { percentOne } from "./sentences";
import type { BaseSite } from "./types";

type Props = {
  sites: BaseSite[];
  caption: string;
  // On screen, inside the planner's panel (which scrolls): 11 px text so all eight columns fit,
  // glass hairlines and a header that stays in view. On paper: 12 px with printable rules.
  compact?: boolean;
};

const cell = "px-1 py-1 text-right";

export function BaseTable({ sites, caption, compact = false }: Props) {
  const rule = compact ? "var(--glass-border)" : "var(--border)";
  return (
    <table className={`bases-table w-full border-collapse tabular-nums ${compact ? "is-compact text-[11px]" : "text-xs"}`}>
      <caption className="pb-1.5 text-left text-[11px]" style={{ color: "var(--text-faint)" }}>
        {caption}
      </caption>
      <thead>
        <tr style={{ borderBottom: `1px solid ${rule}` }}>
          <th scope="col" className={cell}>
            #
          </th>
          <th scope="col" className="px-1 py-1 text-left">
            Biggest town
          </th>
          <th scope="col" className={cell}>
            Lat
          </th>
          <th scope="col" className={cell}>
            Lon
          </th>
          <th scope="col" className={cell} title="What this base adds to the share of summer fire near towns within reach">
            Adds
          </th>
          <th scope="col" className={cell} title="People in listed towns within reach of this base alone">
            People
          </th>
          <th scope="col" className={cell} title="Summer hot spots near towns within reach in the median year, 2003 to 2025">
            Typical year
          </th>
          <th scope="col" className={cell} title="2003 to 2011, the yearly average within reach: raw MODIS count against harmonized">
            2003–11 raw / harm.
          </th>
        </tr>
      </thead>
      <tbody>
        {sites.map((site) => (
          <tr key={site.rank} style={{ borderTop: `1px solid ${rule}` }}>
            <th scope="row" className={cell}>
              {site.rank}
            </th>
            <td className="px-1 py-1 text-left">
              {site.town ?? <span style={{ color: "var(--text-dim)" }}>none within reach</span>}
              {site.town && <span style={{ color: "var(--text-dim)" }}> {site.town_km} km</span>}
            </td>
            <td className={cell}>{site.lat.toFixed(2)}</td>
            <td className={cell}>{site.lon.toFixed(2)}</td>
            <td className={cell}>{percentOne(site.adds)}</td>
            <td className={cell}>{formatCount(site.people)}</td>
            <td className={cell} title={`Busiest year ${site.busiest_year}: ${formatCount(Math.round(site.busiest_count))}`}>
              {formatCount(Math.round(site.typical_year))}
            </td>
            <td className={cell}>
              {formatCount(Math.round(site.early_raw))} / {formatCount(Math.round(site.early_harmonized))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
