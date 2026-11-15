// The printed base list: title, date and sources, a picture of the map, the sentences, the full
// table and the limits. Rendered only while printing, and shown only on paper (bases.css).
import { formatDate } from "../../lib/format";
import { BaseTable } from "./BaseTable";
import { coveredSentence, limitsNote, peopleSentence, selftestSentence, SOURCES_LINE } from "./sentences";
import { SitesSketch } from "./SitesSketch";
import type { BaseSites, ReachResult } from "./types";

type Props = {
  data: BaseSites;
  result: ReachResult;
  count: number;
  mapImage: string | null;
};

export function BasePrint({ data, result, count, mapImage }: Props) {
  const sites = result.sites.slice(0, count);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="base-print text-sm">
      <h1 className="text-xl font-semibold">Pyronac: candidate fire base sites in Canada</h1>
      <p>
        {count === 1 ? "1 base" : `${count} bases`} with a {result.reach_km} km reach. Printed {formatDate(today)}.
        Sites worked out from the harmonized record of {data.years[0]} to {data.years[1]}.
      </p>
      <p style={{ color: "var(--text-dim)" }}>{SOURCES_LINE}</p>
      <figure className="base-print-map">
        {mapImage ? (
          <img src={mapImage} alt={`Map of the ${count} candidate sites and their ${result.reach_km} km reach circles`} />
        ) : (
          <>
            <SitesSketch sites={sites} km={result.reach_km} />
            <figcaption style={{ color: "var(--text-dim)" }}>
              A simple sketch: the map's own picture could not be taken in this browser.
            </figcaption>
          </>
        )}
      </figure>
      <p>
        {coveredSentence(data, result, count)} {selftestSentence(data, result, count)} {peopleSentence(result, count)}
      </p>
      <BaseTable sites={sites} caption={`The first ${count} candidate sites, in pick order`} />
      <p style={{ color: "var(--text-dim)" }}>{limitsNote(data)}</p>
    </div>
  );
}
