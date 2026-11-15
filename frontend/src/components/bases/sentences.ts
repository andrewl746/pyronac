// The base planner in words, from fixed templates in the design note. Numbers come from
// base_sites.json. Never "optimal", "forecast", "predict", a response time or "build here":
// these are best-coverage sites, candidate sites to study.
import { formatCount, monthName } from "../../lib/format";
import type { BaseSite, BaseSites, ReachResult } from "./types";

// 0.081 -> "8%". A share above 0 that rounds to 0 is "under 1%", so it never reads as none, and
// a share below 1 that rounds to 100 is "over 99%", so it never reads as all.
export function percent(share: number): string {
  const whole = Math.round(share * 100);
  if (whole === 0 && share > 0) return "under 1%";
  if (whole === 100 && share < 1) return "over 99%";
  return `${whole}%`;
}

// 0.0812 -> "8.1%", for the table.
export function percentOne(share: number): string {
  const tenths = Math.round(share * 1000) / 10;
  if (tenths === 0 && share > 0) return "<0.1%";
  return `${tenths.toFixed(1)}%`;
}

// Two significant figures: 251,000 -> 250,000. For "About P people", which is not exact.
export function roughly(value: number): number {
  if (value < 100) return Math.round(value);
  const unit = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / unit) * unit;
}

function bases(n: number): string {
  return n === 1 ? "1 base" : `${formatCount(n)} bases`;
}

// "25 bases with a 100 km reach are within reach of 77% of the summer fire near towns since 2003."
export function coveredSentence(data: BaseSites, result: ReachResult, n: number): string {
  const verb = n === 1 ? "is" : "are";
  return `${bases(n)} with a ${result.reach_km} km reach ${verb} within reach of ${percent(result.covered[n - 1])} of the summer fire near towns since ${data.years[0]}.`;
}

// "Tested: 25 bases chosen from 2003 to 2015 alone reached 65% of the fire near towns of 2016 to 2025. Chance reached 22%."
export function selftestSentence(data: BaseSites, result: ReachResult, n: number): string {
  const [trainFrom, trainTo] = data.train_years;
  const [testFrom, testTo] = data.test_years;
  return (
    `Tested: ${bases(n)} chosen from ${trainFrom} to ${trainTo} alone reached ${percent(result.selftest[n - 1])} ` +
    `of the fire near towns of ${testFrom} to ${testTo}. Chance reached ${percent(result.chance[n - 1])}.`
  );
}

// "About 250,000 people live in towns within reach."
export function peopleSentence(result: ReachResult, n: number): string {
  const people = result.people[n - 1];
  if (!(people > 0)) return "No listed town is within reach.";
  return `About ${formatCount(roughly(people))} people live in towns within reach.`;
}

// "From 2003 to 2011 a year within reach averaged 310 hot spots in the raw record and 1,450 harmonized."
export function earlySentence(site: BaseSite): string {
  return (
    `From 2003 to 2011 a year within reach averaged ${formatCount(Math.round(site.early_raw))} hot spots ` +
    `in the raw record and ${formatCount(Math.round(site.early_harmonized))} harmonized.`
  );
}

// The limits, always shown with the results.
export function limitsNote(data: BaseSites): string {
  const [from, to] = data.months;
  return (
    `Candidate sites to study, not a forecast. Counts ${monthName(from)} to ${monthName(to)} hot spots within ` +
    `${data.town_km} km of a town of ${formatCount(data.town_min_people)} or more people. ` +
    `The list stops when a new base would add under ${formatCount(data.min_add * 100)}%, and no city of ` +
    `${formatCount(data.city_min_people)} or more people gets more than ${data.bases_per_city} bases within reach. The record does not know ` +
    `roads, water or land cover, and a few southern sites reflect farm burning. Positions are good to about 11 km.`
  );
}

export const SOURCES_LINE = "Sources: NASA FIRMS (MODIS and VIIRS hot spots), GeoNames (CC BY 4.0).";

// "Kamloops, 42 km" or "no listed town within reach"
export function townLabel(site: BaseSite): string {
  return site.town ? `${site.town}, ${site.town_km} km` : "no listed town within reach";
}

// "59.15, -120.35": plain ASCII so it can be pasted into other tools.
export function position(site: BaseSite): string {
  return `${site.lat.toFixed(2)}, ${site.lon.toFixed(2)}`;
}
