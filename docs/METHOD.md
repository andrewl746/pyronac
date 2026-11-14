# Method: how Pyronac harmonizes MODIS and VIIRS hot spots

Status: Saturday 14 November 2026, 15:00 Toronto time. Final data for the demo. Data: Canada, India and
Brazil from NASA FIRMS: MODIS 2003 to 14 November 2026, VIIRS on Suomi NPP 20 January 2012 to 2 November
2026, VIIRS on NOAA-20 April 2018 to 14 November 2026. Every number in this file comes from that build.

## In short

| | Typical monthly total off by | Typical yearly total off by |
|---|---|---|
| Raw MODIS, nothing done | 78.5% | |
| What the app ships | 9.2% | 2.6% |

Tested on 2020 to 2025, years the methods never learned from, all three countries together. For
2003 to January 2012 the app uses a machine learning model for Canada and the ratio method for India
and Brazil, because that is where each one tested better (see "Which method each country uses").

## The problem in one table

Counting hot spots as the satellites reported them, each country's fire record jumps between 2011
and 2012. Nothing changed on the ground. The record switches from MODIS (1 km pixels) to VIIRS (375 m
pixels), and VIIRS sees several hot spots where MODIS sees one.

| Country | 2010 raw | 2010 harmonized | 2011 raw | 2011 harmonized | 2012 raw | 2013 raw |
|---|---|---|---|---|---|---|
| Canada | 44,923 | 232,606 | 33,224 | 161,870 | 169,914 | 311,138 |
| India | 71,169 | 380,517 | 67,570 | 368,246 | 442,721 | 359,046 |
| Brazil | 553,391 | 2,121,610 | 257,363 | 959,336 | 1,450,709 | 775,066 |

From February 2012 the harmonized record is the Suomi NPP count itself, apart from the days Suomi NPP
recorded almost nothing (see "Suomi NPP's outage days"), so 2012 (apart from January) and 2013 are
the same in both versions.

## What we found in the data

Over all the months both instruments flew, VIIRS on Suomi NPP reports 5.74 hot spots for every MODIS
hot spot over Canada, 5.65 over India and 3.79 over Brazil. Within a country the ratio is not one
number. Over Canada it changes with the season, from about 3.2 in April and 3.4 in October to 6.4 in
August, and with place, from about 4.3 in the far west (longitude -140 to -130) to about 6.2 between
longitude -120 and -90. It also changes from year to year, from 3.4 in the quiet year 2020 to 7.4 in
2014, and no fixed table of ratios can know that in advance, which is the main source of the error
that remains.

| Calendar month (Canada) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Suomi NPP per MODIS detection | 4.30 | 5.45 | 5.99 | 3.17 | 4.41 | 5.26 | 6.23 | 6.41 | 5.81 | 3.42 | 3.99 | 4.66 |

Over Canada, about 4.5% of Suomi NPP detections fall in a cell and month where MODIS saw nothing at all.

## The ratio method (used for India and Brazil, and the baseline the model has to beat)

The reference scale is VIIRS on Suomi NPP. `harmonized_count` answers "how many hot spots would
Suomi NPP have reported for this cell in this month?"

1. Cut the map into 1 degree blocks. For each block and each calendar month, divide the Suomi NPP
   detections by the MODIS detections over the months when both flew (February 2012 onwards).
2. Trust a block's own ratio only when it rests on at least 50 MODIS detections for that calendar
   month. Otherwise use the country's ratio for that calendar month, and if that is thin too, the
   country's overall ratio.
3. Before February 2012, `harmonized_count` is the MODIS count times that ratio. A cell MODIS never
   saw stays at zero. The block ratio already carries those fires in the block's total.
4. From February 2012 to October 2026 it is the Suomi NPP count, unchanged, except on the days Suomi
   NPP recorded almost nothing, which use NOAA-20 instead (see "Suomi NPP's outage days").
5. From November 2026 it is the NOAA-20 count times a handoff ratio, learned the same way from
   April 2018 to October 2025, when both VIIRS satellites flew.

The code is `pipeline/harmonize.py`.

## Validation

We learn on 2012 to 2019 only, apply the result to MODIS for 2020 to 2025, and compare with what
Suomi NPP really reported in those years. The error is the median absolute percentage error: 18%
means the typical total is 18% away from the observed one. "Raw" is the MODIS count with nothing done
to it. Totals with fewer than 20 Suomi NPP detections are left out, because a percentage of a handful
of detections is noise. "Suomi NPP, observed" has its outage days filled from NOAA-20, because a day
with no data is not a day with no fire.

The ratio method on its own (`python pipeline/validate.py`):

| Country | Monthly, raw | Monthly, ratio method | Months | Yearly, raw | Yearly, ratio method | Years |
|---|---|---|---|---|---|---|
| Brazil | 70.2% | 5.2% | 72 | 73.5% | 5.3% | 6 |
| Canada | 79.9% | 17.1% | 72 | 82.2% | 8.0% | 6 |
| India | 81.9% | 10.0% | 72 | 82.4% | 2.5% | 6 |
| All three | 78.5% | 10.4% | 216 | | | |

After validating, the ratios the app uses are learned again on every overlap month.

Rule we follow when trying other versions of the method: versions are compared inside 2012 to 2019
only, leaving one year out at a time. 2020 to 2025 is used for the final numbers and for the final
comparison between the ratio method and the ML model, never for tuning. (How often that exam has been
used so far is listed under "Honest notes".)

### Is the block-level ratio worth it? (Canada)

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
region-months, 1,239 block-years). These comparison numbers came from a one-off script, before Suomi
NPP's outage days were filled, and are not reproduced by `validate.py`. On the final build, `ml_model.py --per-country --test` gives one ratio for the country 18.0% monthly, 7.5% yearly
and 28.9% for 5 degree regions per year in Canada, against 17.1%, 8.0% and 19.8% for ours.

## The ML model

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
the same 1 degree block that MODIS did see, so the model's totals include them. The model learns from,
and is tested against, Suomi NPP counts with the outage days filled.

A model either predicts the Suomi NPP count directly ("count") or predicts Suomi NPP detections per
MODIS detection and multiplies back ("rate"). It is learned either from every country at once
("shared") or from one country's own cell-months ("per-country").

## Which method each country uses

The rule, fixed before each test was run: a model replaces the ratio method only if, on 2020 to 2025,
it is lower than the ratio method on monthly, yearly and regional totals, and at least 2 points lower
on monthly totals.

It took three rounds to get here, all before the final build. The numbers in rounds 1 and 2 are
from builds before Suomi NPP's outage days were filled.

**Round 1, Canada only.** Twelve versions of one model (two targets, three sets of inputs, two
settings) were compared inside 2012 to 2019. The best, a count model with every input, then sat the
2020 to 2025 test against the ratio method: 13.5% monthly, 1.6% yearly and 14.6% for regions, against
18.1%, 9.9% and 21.1%. It passed.

**Round 2, the same model shared across all three countries.** On 2020 to 2025 it was clearly better
for Canada (13.1% monthly, 1.3% yearly) but worse than the ratio method for India (14.3% monthly against
9.7%) and Brazil (6.9% against 6.3% monthly, 6.6% against 3.8% yearly).

**Round 3, a choice per country.** Five candidates per country: the shared model, and four per-country
models (count or rate, basic or full inputs). Each country's candidate was chosen inside 2012 to 2019,
then that one candidate sat the 2020 to 2025 test. Rerun on the final build:

Inside 2012 to 2019, one year left out at a time:

| Country | Ratio method (monthly / yearly / regions) | Chosen candidate | Chosen candidate (monthly / yearly / regions) |
|---|---|---|---|
| Brazil | 3.9% / 0.4% / 4.8% | per-country, rate, full inputs | 3.3% / 1.0% / 4.7% |
| Canada | 13.5% / 3.9% / 16.5% | per-country, rate, full inputs | 9.8% / 3.9% / 14.2% |
| India | 8.1% / 6.4% / 8.9% | per-country, count, basic inputs | 6.9% / 3.9% / 7.7% |

On 2020 to 2025:

| Country | Ratio method (monthly / yearly / regions) | Chosen model (monthly / yearly / regions) | Result |
|---|---|---|---|
| Brazil | 5.2% / 5.3% / 7.1% | 5.1% / 4.7% / 6.6% | ratio method |
| Canada | 17.1% / 8.0% / 19.8% | 14.8% / 1.3% / 14.7% | model |
| India | 10.0% / 2.5% / 6.8% | 12.4% / 1.2% / 7.1% | ratio method |

These are the same choices and the same decisions as on the builds before the outage fill. Canada's
model is 2.3 points lower on monthly totals (it was 3.3), still more than the 2 points the rule asks
for. Brazil's model is now lower than the ratio method on all three levels, but by only 0.1 points on
monthly totals, so the rule keeps the ratio method there.

So the app uses Canada's own rate model for Canada, and the ratio method for India and Brazil. That
is `MODEL_FOR` in `pipeline/ml_model.py`. Run the comparison with
`python pipeline/ml_model.py --per-country --test`. The build falls back to the ratio method
everywhere when scikit-learn is not installed.

What the app ships, tested on 2020 to 2025:

| | Monthly | Yearly | 5 degree regions, yearly | Total vs observed |
|---|---|---|---|---|
| All three countries | 9.2% | 2.6% | 9.5% | -0.7% |
| Brazil (ratio method) | 5.2% | 5.3% | 7.1% | |
| Canada (model) | 14.8% | 1.3% | 14.7% | |
| India (ratio method) | 10.0% | 2.5% | 6.8% | |

| Shipped estimate vs Suomi NPP observed | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| Brazil | -6.3% | -4.4% | -6.3% | +2.5% | -0.8% | +10.5% |
| Canada | -1.5% | +0.3% | -6.2% | -1.0% | +5.9% | -0.8% |
| India | -0.6% | +4.0% | -2.3% | -0.8% | -2.7% | +6.6% |

For Canada before 2012, the model gives yearly totals between 1% and 11% lower than the ratio method
would (2003: 206,914 against 230,753; 2004: 307,612 against 311,836; 2010: 232,606 against 238,209).

### Honest notes

- **The 2020 to 2025 test has been used more than once.** For Canada, seven times: twice in round 1 (the first run gave 13.1%, 2.2% and 15.5%, then the
  script turned out not to give the same result on every run, and after fixing the row order it gave
  13.5%, 1.6% and 14.6%), once in round 2, once in round 3, and three more times with the same model
  and procedure after fixes to the data and code: the repeatable FRP sums, the outage fill (on Canada
  alone), and this final build. For India and Brazil, four times: rounds 2 and 3, the FRP fix and
  this final build. No model was changed after
  seeing a test result. But round 3 was added because round 2 failed for India and Brazil, so the
  test did shape which question we asked next. Each extra look makes the test a little less of a
  surprise.
- **Looking good in training did not carry over.** Inside 2012 to 2019 the chosen per-country models
  beat the ratio method clearly for Canada, and on most levels for India and Brazil. On 2020 to 2025
  only Canada's held up by the margin the rule asks for (Brazil's model was 0.1 points better on
  monthly totals, India's was worse). Our reading, not proven: India's crop fires and Brazil's land-clearing fires
  recur in much the same places and months each year, so a fixed per-place, per-month ratio already
  fits them well and a model mostly adds noise. Canada's forest fire seasons swing much more from
  year to year, which a model can follow.
- **Canada ships the round 3 model,** even though the round 1 and 2 versions scored slightly better
  on earlier tests. Round 3's candidate was the one the procedure chose inside 2012 to 2019. Switching
  to an earlier one now would mean choosing by test score.
- **2024 in Canada used to be the one year far off (+16%).** Most of that was Suomi NPP, not the
  model: Suomi NPP has no data for 10 days of July 2024, at the height of the season, so the observed
  total it was compared with was too low. With the outage days filled, Canada 2024 is +5.9%. Brazil
  2025 (+10.5%) and India 2025 (+6.6%) are now the largest.
- **Filling the outage days made the yearly error larger,** 1.9% to 2.6% for the three countries,
  mostly Brazil (3.8% to 5.3%): the filled 2022 and 2024 totals are higher, and the ratio method,
  learned on 2012 to 2019, falls short of them. The monthly error got smaller (9.6% to 9.2%). We
  report the filled numbers because the unfilled ones compared the estimates with days of missing data.
- **Rebuilds used to give slightly different estimates for 2003 to January 2012** (Yuvi spotted it).
  The build added up each cell's fire radiative power (FRP) on several threads at once. Each addition
  is rounded a little, so the last digits of a sum depended on the order, by at most about one
  ten-billionth. The model uses those sums as inputs, and that was enough to change it: adding the same
  values in another order changed all 53,872 of Canada's pre-2012 estimates (by up to 88 hot spots in
  a cell and month, and up to 0.8% in a year's total) and moved Canada's monthly test error from 14.0%
  to 14.4%. Now `pipeline/build.py` adds FRP up as exact decimals, `pipeline/ml_model.py` rounds each
  sum to three decimals before the model sees it (FIRMS gives FRP to two), the error figures are added
  up in a fixed order, and the outage fill is rounded to a multiple of 1/1024 so that every sum of it
  is exact. Any order now gives identical estimates and errors. The lesson: a change too small to
  mean anything moved Canada's monthly test error by almost a point, so gaps that small between
  versions of a model are noise.

## The second handoff: Suomi NPP to NOAA-20

Suomi NPP stopped delivering new data on 2 November 2026. From November 2026 the record continues on
NOAA-20, which carries the same instrument. Both flew together from April 2018, so the difference can
be measured directly.

Over April 2018 to October 2025, with Suomi NPP's outage days filled (next section), Suomi NPP
reported 1.023 hot spots for every NOAA-20 hot spot over Canada, 0.993 over India and 1.029 over
Brazil. These are the handoff ratios the app applies, one per country. (The single
`handoff_ratio_noaa20` value in `harmonization.json`, 1.0205, is the three countries pooled. The spec
has room for one number only.) Before the outage days were filled they came out at 0.997, 0.987 and
1.011, and 2024 looked like an odd year for Canada at 0.902. That was the July 2024 outage.

| Suomi NPP per NOAA-20 detection | 2018 (from April) | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 (to October) |
|---|---|---|---|---|---|---|---|---|---|
| Brazil | 1.027 | 1.025 | 1.028 | 1.033 | 1.026 | 1.040 | 1.025 | 1.024 | 1.028 |
| Canada | 1.028 | 0.970 | 0.989 | 0.996 | 1.018 | 1.054 | 0.997 | 1.011 | 1.004 |
| India | 0.968 | 1.020 | 0.998 | 1.005 | 0.970 | 0.987 | 0.984 | 0.993 | 0.992 |

The 2026 data gives a check on months the ratios were not learned from. For January to October 2026,
NOAA-20 times the handoff ratio is a median 2.8% away from what Suomi NPP observed in Brazil, 3.7% in
Canada and 2.4% in India (10 months each). The largest gaps are in quiet months: Canada's March (24.8%,
under 300 detections) and India's August (16.0%, under 1,000).

October 2026 was the last full month with both satellites:

| October 2026 | Suomi NPP | NOAA-20 | NOAA-20 vs Suomi NPP |
|---|---|---|---|
| Brazil | 183,002 | 182,147 | -0.5% |
| Canada | 4,577 | 4,738 | +3.5% |
| India | 11,689 | 12,874 | +10.1% |

(India's Suomi NPP count includes the fill for two outage days, 20 and 30 October.)

From 1 November 2026 the record is NOAA-20 times the handoff ratio. In the app, Suomi NPP detections
stop on 31 October and NOAA-20 detections start on 1 November, with no gap and no double counting.
India's last overlap month disagreed by much more than its 2018 to 2025 average, so India's record
from November 2026 is the least certain part of it.

## Suomi NPP's outage days

On some days Suomi NPP delivered almost no data while NOAA-20 kept seeing fires. We count a day as an
outage in a country when Suomi NPP reported under a quarter of NOAA-20's count there and NOAA-20
reported at least 20 detections. On a typical outage day Suomi NPP reported nothing at all. On other
days Suomi NPP reports at least 73% of NOAA-20's count 95% of the time in Brazil, 66% in Canada and
48% in India, so the cut is clear in Brazil and Canada and less clear in India.

From April 2018 to October 2026 that is 59 days in Brazil, 53 in Canada and 58 in India, mostly the
same dates in all three, because the gaps are the satellite's: 2022, 2024 and 2026 have most of them,
including 11 to 16 July 2026 (and 10 July in Canada).

On those days the record uses NOAA-20 times the handoff ratio, learned from the normal days. This adds
179,380 detections in Brazil, 221,051 in Canada and 48,749 in India. The months that change most:

| Month | Suomi NPP observed | Added for its outage days |
|---|---|---|
| Canada, July 2026 | 177,070 | +106,509 (+60%) |
| Canada, July 2024 | 177,237 | +66,603 (+38%) |
| Brazil, July 2024 | 74,450 | +47,486 (+64%) |
| Brazil, August 2022 | 270,074 | +45,776 (+17%) |
| India, March 2026 | 87,603 | +15,732 (+18%) |

The filled counts are used for `harmonized_count`, for learning the ratios and the model, and as the
truth in the validation. `snpp_count` and the downloadable hot spots stay exactly as Suomi NPP
reported them, so in an outage month `harmonized_count` is higher than `snpp_count`. The fill is saved
as `snpp_fill.parquet`, which `validate.py` and `ml_model.py` apply when run on their own.

## Non-fire sources in the newest files

The yearly and archive files label each detection, and the build keeps only presumed vegetation
fires. The near-real-time files, which cover August to November 2026 for VIIRS and September to
November 2026 for MODIS, have no label, so gas flares, steel plants and other industrial heat sources
would stay in.

So the build drops near-real-time detections at small spots (0.005 degrees, about 500 m) that the
labelled VIIRS files mark as non-fire at least 3 times, and at least as often as fire. Tested on 2025
as if it had no labels, with the spots learned from 2018 to 2024 (Suomi NPP, against the labelled
fire count):

| 2025 | August | September | October | November |
|---|---|---|---|---|
| Brazil, without the filter | +1.3% | +0.8% | +0.7% | +1.3% |
| Brazil, with it | -0.0% | +0.0% | +0.0% | +0.1% |
| Canada, without the filter | +5.5% | +4.9% | +21.5% | +7.2% |
| Canada, with it | +4.8% | +2.3% | +0.0% | +0.0% |
| India, without the filter | +216% | +212% | +73% | +26% |
| India, with it | +6.0% | +4.8% | +1.8% | +1.0% |
| Punjab and Haryana box, without the filter | +122% (18 fires) | +11.4% | +2.3% | +2.0% |
| Punjab and Haryana box, with it | +0.0% | +3.0% | +0.0% | +0.3% |

In India's quiet months most "hot spots" are industry, which is why the filter matters most there.
Real fires dropped by mistake: under 1% a month in Brazil and Canada, but 3% to 8% in India's
quietest months (July to October), when there are few real fires; 0.14% in the Punjab box in October.
In summer most of Canada's non-fire detections are not at fixed places, so August stays about 5% high.

In the 2026 data the filter removes 26,733 of the served detections. Suomi NPP's count drops by 31% in
September and 18% in October in Canada, by 56%, 68% and 45% in August, September and October in India,
and by about 1% in Brazil.

## Limits

- A single month in a single region can still be well off. The typical 5 degree region and year is
  about 9.5% away from what Suomi NPP observed across the three countries, and about 14.7% in Canada.
- MODIS before 2012 is assumed to behave like MODIS after 2012. Sensor ageing is not accounted for.
- The 2003 to 2011 estimates cannot be checked directly, because VIIRS did not exist then.
- Only three countries have been tested. Another country would need the same per-country test before
  the app says anything about it.
- Suomi NPP's outages before April 2018 cannot be filled, because NOAA-20 was not flying yet.
- In the near-real-time months, non-fire sources that are not at a fixed place stay in (about 5% of
  Canada's August in 2025), and in India some real fires at known industrial spots are dropped.
