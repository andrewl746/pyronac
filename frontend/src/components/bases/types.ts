// The shape of base_sites.json, worked out once in Python by pipeline/base_sites.py.
// The contract is in the base planner design note. Kept here, not in api/types.ts: it is not an
// API response, it is a file shipped with the screen.

export type BaseSite = {
  rank: number; // 1 is the first pick
  lat: number; // cell centre, 2 decimals (good to about 11 km)
  lon: number;
  town: string | null; // the biggest listed town within reach, null when there is none
  town_people: number;
  town_km: number;
  people: number; // people in listed towns within reach of this base alone
  adds: number; // share (0 to 1) this base adds to `covered`
  typical_year: number; // the median year's near-town summer hot spots within reach of this base alone
  busiest_year: number;
  busiest_count: number;
  early_raw: number; // 2003 to 2011 yearly average within reach, raw MODIS counts
  early_harmonized: number; // the same, harmonized
};

// In km. The choices are the `reaches` in base_sites.json (50 and 100 today).
export type Reach = number;

export type ReachResult = {
  reach_km: Reach;
  // Four arrays as long as `sites` (the list length differs by reach), indexed by n - 1 for the first n bases.
  covered: number[]; // share of near-town summer hot spots, all years, within reach
  selftest: number[]; // bases chosen from train_years, scored on test_years
  chance: number[]; // the same test with random fire sites near towns
  people: number[]; // people in listed towns within reach, each town counted once
  sites: BaseSite[]; // in pick order
};

export type BaseSites = {
  generated: string;
  country: string;
  years: [number, number];
  months: [number, number];
  town_km: number;
  town_min_people: number;
  min_add: number; // the list stops when the next base would add less than this share
  city_min_people: number; // a "city" for the rule below
  bases_per_city: number; // no city gets more than this many bases within reach
  train_years: [number, number];
  test_years: [number, number];
  near_town_share: number;
  sources: { fire: string; towns: string };
  reaches: ReachResult[];
};
