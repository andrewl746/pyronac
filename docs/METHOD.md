# Method: how Pyronac harmonizes MODIS and VIIRS hot spots

Status: Saturday 14 November 2026. Numbers are for Canada, from NASA FIRMS: the yearly files for
MODIS 2003 to 2025, VIIRS on Suomi NPP 2012 to 2025 and VIIRS on NOAA-20 2018 to 2025, and the 2026
archive and near-real-time files, which run to 14 November 2026.

## The problem in one table

Counting hot spots as the satellites reported them, Canada's fire record jumps fivefold between 2011
and 2012. Nothing changed on the ground. The record switches from MODIS (1 km pixels) to VIIRS (375 m
pixels), and VIIRS sees several hot spots where MODIS sees one.

| Year | Raw record | Harmonized record |
|---|---|---|
| 2009 | 25,814 | 101,760 |
| 2010 | 44,923 | 229,775 |
| 2011 | 33,224 | 163,496 |
| 2012 | 169,914 | 170,549 |
| 2013 | 311,138 | 311,138 |
| 2014 | 460,528 | 460,528 |

## What we found in the data

VIIRS on Suomi NPP reports about 5.6 hot spots for every MODIS hot spot over Canada, but the ratio is
not one number. It changes with the season, from about 3.1 in April and 3.4 in October to 6.4 in
August, and with place, from about 4.2 in the far west (longitude -140 to -130) to about 6 between
longitude -120 and -90. It also changes from year to year, from 3.4 in the quiet year 2020 to 7.4 in
2014, and no fixed table of ratios can know that in advance, which is the main source of the error
that remains.

| Calendar month | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Suomi NPP per MODIS detection | 4.19 | 5.48 | 5.96 | 3.12 | 4.42 | 5.22 | 5.77 | 6.41 | 5.82 | 3.40 | 3.96 | 4.66 |

About 4.5% of Suomi NPP detections fall in a cell and month where MODIS saw nothing at all.

## The ratio method (the fallback, and the baseline the model has to beat)

The reference scale is VIIRS on Suomi NPP. `harmonized_count` answers "how many hot spots would
Suomi NPP have reported for this cell in this month?"

1. Cut the map into 1 degree blocks. For each block and each calendar month, divide the Suomi NPP
   detections by the MODIS detections over the months when both flew (February 2012 onwards).
2. Trust a block's own ratio only when it rests on at least 50 MODIS detections for that calendar
   month. Otherwise use the country's ratio for that calendar month, and if that is thin too, the
   country's overall ratio.
3. Before February 2012, `harmonized_count` is the MODIS count times that ratio. A cell MODIS never
   saw stays at zero. The block ratio already carries those fires in the block's total.
4. From February 2012 to October 2026 it is the Suomi NPP count, unchanged, except on the days
   Suomi NPP recorded almost nothing (see "Suomi NPP's outage days" below).
5. From November 2026 it is the NOAA-20 count times a handoff ratio, learned the same way from
   April 2018 to October 2025, when both VIIRS satellites flew.

The code is `pipeline/harmonize.py`.

## Validation

We learn the ratios on 2012 to 2019 only, apply them to MODIS for 2020 to 2025, and compare with
what Suomi NPP really reported in those years. The error is the median absolute percentage error:
18% means the typical total is 18% away from the observed one. "Raw" is the MODIS count with nothing
done to it. Totals with fewer than 20 Suomi NPP detections are left out, because a percentage of a
handful of detections is noise. Run it with `python pipeline/validate.py`. "Suomi NPP, observed"
has its outage days filled from NOAA-20, because a day with no data is not a day with no fire.

| Country | Monthly, raw | Monthly, harmonized | Months | Yearly, raw | Yearly, harmonized | Years |
|---|---|---|---|---|---|---|
| canada | 79.9% | 17.1% | 72 | 82.2% | 8.0% | 6 |

| Country | Year | MODIS, raw | Harmonized estimate | Suomi NPP, observed | Estimate vs observed |
|---|---|---|---|---|---|
| canada | 2020 | 11,033 | 39,344 | 37,262 | +5.6% |
| canada | 2021 | 83,292 | 476,488 | 430,732 | +10.6% |
| canada | 2022 | 29,337 | 165,226 | 159,637 | +3.5% |
| canada | 2023 | 280,489 | 1,459,138 | 1,656,055 | -11.9% |
| canada | 2024 | 127,920 | 751,147 | 739,449 | +1.6% |
| canada | 2025 | 132,777 | 769,460 | 859,509 | -10.5% |

After validating, the ratios the app uses are learned again on every overlap month.

Rule we follow when trying other versions of the method: versions are compared inside 2012 to 2019
only, leaving one year out at a time. 2020 to 2025 is used for the final numbers and for the final
comparison between the ratio method and the ML model, never for tuning.

### Is the block-level ratio worth it?

We compared it with two simpler versions on the same held-out years. For the whole country a single
ratio does about as well, and better on yearly totals. For regions, which is what a user of the app
selects, the block-level ratio is clearly better.

| Method | Canada, monthly | Canada, yearly | 5 degree regions, yearly | 5 degree regions, monthly | 1 degree blocks, yearly |
|---|---|---|---|---|---|
| Raw MODIS | 79.9% | 80.8% | 79.2% | 79.0% | 80.5% |
| One ratio for the country | 19.3% | 6.2% | 32.2% | 32.6% | 31.2% |
| Country ratio per calendar month | 18.5% | 14.9% | 28.8% | 29.9% | 30.5% |
| Block and calendar month (ours) | 18.1% | 9.9% | 21.1% | 25.0% | 26.8% |

Regional rows count only totals with at least 200 Suomi NPP detections (239 region-years, 641
region-months, 1,239 block-years). These comparison numbers came from a one-off script and are not
yet reproduced by `validate.py`. They were computed before Suomi NPP's outage days were filled. With
the fill, `ml_model.py --test` gives one ratio for the country 18.0% monthly, 7.5% yearly and 28.9%
for 5 degree regions per year, against 17.1%, 8.0% and 19.8% for ours.

## The ML model (what the app uses for 2003 to January 2012)

The ratio method cannot follow the year to year change in the ratio. A model that sees more about
each cell and month can. We use gradient boosting (`HistGradientBoostingRegressor` with Poisson loss)
to estimate the Suomi NPP count of a cell and month. Every input comes from MODIS detections alone,
so the model can be applied to years before VIIRS existed:

- the MODIS count and fire radiative power (sum, mean, maximum) of the cell that month
- the month, and the cell's latitude and longitude
- MODIS counts nearby: the 8 and 24 surrounding cells, the 1 degree block, the whole country that
  month and that year, and the same cell one month before and after
- the Terra and Aqua counts separately, the day and night counts separately, the number of
  high-confidence detections, and the number of days with a detection

Suomi NPP detections in a cell and month where MODIS saw nothing are shared out among the cells of
the same 1 degree block that MODIS did see, so the model's totals include them.

How it was chosen. Twelve versions (two targets, three sets of inputs, two settings) were compared
inside 2012 to 2019 only, leaving one year out at a time. They all came out close to each other and
all ahead of the ratio method there (about 10% against 13.5% on monthly totals). We fixed in advance
that the model would replace the ratio only if it was lower on all three levels on 2020 to 2025 and
at least 2 points lower on monthly totals. Then the chosen version was run on 2020 to 2025.

| Method, tested on 2020 to 2025 | Canada, monthly | Canada, yearly | 5 degree regions, yearly | Total vs observed |
|---|---|---|---|---|
| Raw MODIS | 79.9% | 82.2% | 79.8% | |
| Ratio method | 17.1% | 8.0% | 19.8% | -5.7% |
| ML model | 13.6% | 1.8% | 14.0% | +0.1% |

| Year | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| ML estimate vs Suomi NPP observed | -1.3% | +2.2% | -6.6% | -1.3% | +4.8% | -1.0% |

Honest notes on this result:

- The first run of the test gave 13.1%, 2.2% and 15.5%. The script then turned out not to give
  identical results on every run, because the rows reached the model in no fixed order. After fixing
  the order, the numbers are the ones in the table, and a rebuild now gives the same answer every time.
  So the test years were run twice, with the same version and no change to the method.
- 2024 was the one year far off, at +14.8%. Most of that was Suomi NPP, not the model: Suomi NPP
  has no data for 10 days of July 2024, at the height of the season, so the observed total it was
  compared with was too low. With its outage days filled from NOAA-20, 2024 is +4.8%. Filling them
  did not change the decision: the model is still lower than the ratio method on all three levels,
  and 3.5 points lower on monthly totals.
- Rebuilds were still not exactly repeatable. Fire radiative power was added up in floating point by
  several threads at once, so its last digits depended on the order of the additions, and the monthly
  error moved between 13.5% and 13.8% from one rebuild to the next. The sums are now exact (decimal
  arithmetic in `pipeline/build.py`), and a rebuild gives the same numbers.
- For 2003 to 2011 the model gives totals 2% to 12% lower than the ratio method, depending on the year.

Run the comparison with `python pipeline/ml_model.py` (add `--test` for the final test). The build
uses the model when scikit-learn is available and falls back to the ratio method when it is not.

## The second handoff: Suomi NPP to NOAA-20

Suomi NPP stopped delivering new data on 2 November 2026. From November 2026 the record continues on
NOAA-20, which carries the same instrument. Both flew together from April 2018, so the difference can
be measured directly.

Over April 2018 to October 2025, with Suomi NPP's outage days filled (next section), Suomi NPP
reported 1.023 hot spots for every NOAA-20 hot spot over Canada. Month by month the two differ more
than that: the typical monthly total is 3.0% apart (91 months), and whole years range from 0.970
(2019) to 1.054 (2023).

| Year | 2018 (from April) | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 (to October) |
|---|---|---|---|---|---|---|---|---|---|
| Suomi NPP per NOAA-20 detection | 1.028 | 0.970 | 0.989 | 0.996 | 1.018 | 1.054 | 0.997 | 1.011 | 1.004 |

So the handoff ratio is close to 1 and is applied the same way as the MODIS ratio, as one number per
country. Before the outage days were filled it came out at 0.997, and 2024 looked like an odd year at
0.902. That was the July 2024 outage.

The 2026 data gives a check on months the ratio was not learned from. For January to October 2026,
NOAA-20 times 1.023 is a median 3.7% away from what Suomi NPP observed (10 months; the largest gap,
24.8%, is March, with under 300 detections). From November 2026 the app shows NOAA-20 times the
ratio, and the daily counts run on across 1 November with no step.

## Suomi NPP's outage days

On some days Suomi NPP delivered almost no data while NOAA-20 kept seeing fires. On a normal day
Suomi NPP reports at least 62% of NOAA-20's count 95% of the time. We count a day as an outage when
Suomi NPP reported under a quarter of NOAA-20's count and NOAA-20 reported at least 20 detections. In
Canada that is 53 days from April 2018 to October 2026, including 10 days in July 2024 and 10 to 16
July 2026.

On those days the record uses NOAA-20 times the handoff ratio, learned from the normal days. This adds
221,052 detections over 5,288 cell-months. The months that change most:

| Month | Suomi NPP observed | Added for its outage days |
|---|---|---|
| July 2026 | 177,070 | +106,509 (+60%) |
| July 2024 | 177,237 | +66,603 (+38%) |
| July 2025 | 258,750 | +17,952 (+7%) |
| July 2023 | 394,530 | +14,377 (+4%) |
| August 2022 | 37,095 | +5,593 (+15%) |

The filled counts are used for `harmonized_count`, for learning the ratios and the model, and as the
truth in the validation. `snpp_count` and the downloadable hot spots stay exactly as Suomi NPP
reported them, so in an outage month `harmonized_count` is higher than `snpp_count`. The fill is saved
as `snpp_fill.parquet`, which `validate.py` and `ml_model.py` apply when run on their own.

## Non-fire sources in the newest files

The yearly and archive files label each detection, and the build keeps only presumed vegetation
fires. The near-real-time files, which cover August to November 2026 for VIIRS and September to
November 2026 for MODIS, have no label, so gas flares and other industrial heat sources would stay
in. In quiet months they are a large share: in October 2025 they were 17% of Suomi NPP detections.

So the build drops near-real-time detections at small spots (0.005 degrees) that the labelled VIIRS
files mark as non-fire at least 3 times, and at least as often as fire. Tested on 2025 as if it had
no labels, with the spots learned from 2018 to 2024:

| Suomi NPP, 2025, against the labelled count | August | September | October | November |
|---|---|---|---|---|
| Without the filter | +5.5% | +4.9% | +21.5% | +7.2% |
| With the filter | +4.8% | +2.3% | +0.0% | +0.0% |

Real fires dropped by mistake: 0.05%. In summer most non-fire detections are not at fixed places, so
August stays about 5% high. In the 2026 data the filter removes 31% of Suomi NPP's September and 18%
of its October.

## Limits

- A single month in a single region can still be well off. The typical 5 degree region and year is
  about 15% away from what Suomi NPP observed.
- MODIS before 2012 is assumed to behave like MODIS after 2012. Sensor ageing is not accounted for.
- The 2003 to 2011 estimates cannot be checked directly, because VIIRS did not exist then.
- Tested on Canada only so far.
- Suomi NPP's outages before April 2018 cannot be filled, because NOAA-20 was not flying yet.
- In the near-real-time months, non-fire sources that are not at a fixed place stay in (about 5%
  of August in 2025).
