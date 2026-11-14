# Method: how Pyronac harmonizes MODIS and VIIRS hot spots

Status: Saturday 14 November 2026, afternoon. Data: Canada, India and Brazil from NASA FIRMS: MODIS
2003 to 14 November 2026, VIIRS on Suomi NPP 20 January 2012 to 2 November 2026, VIIRS on NOAA-20
April 2018 to 14 November 2026.

## In short

| | Typical monthly total off by | Typical yearly total off by |
|---|---|---|
| Raw MODIS, nothing done | 77.7% | |
| What the app ships | 9.6% | 1.9% |

Tested on 2020 to 2025, years the methods never learned from, all three countries together. For
2003 to January 2012 the app uses a machine learning model for Canada and the ratio method for India
and Brazil, because that is where each one tested better (see "Which method each country uses").

## The problem in one table

Counting hot spots as the satellites reported them, each country's fire record jumps between 2011
and 2012. Nothing changed on the ground. The record switches from MODIS (1 km pixels) to VIIRS (375 m
pixels), and VIIRS sees several hot spots where MODIS sees one.

| Country | 2010 raw | 2010 harmonized | 2011 raw | 2011 harmonized | 2012 raw | 2013 raw |
|---|---|---|---|---|---|---|
| Canada | 44,923 | 234,642 | 33,224 | 152,876 | 169,914 | 311,138 |
| India | 71,169 | 378,108 | 67,570 | 366,112 | 442,721 | 359,046 |
| Brazil | 553,391 | 2,103,516 | 257,363 | 951,519 | 1,450,709 | 775,066 |

From February 2012 the harmonized record is the Suomi NPP count itself, so 2012 (apart from January)
and 2013 are the same in both versions.

## What we found in the data

Over all the months both instruments flew, VIIRS on Suomi NPP reports 5.55 hot spots for every MODIS
hot spot over Canada, 5.62 over India and 3.75 over Brazil. Within a country the ratio is not one
number. Over Canada it changes with the season, from about 3.1 in April and 3.4 in October to 6.4 in
August, and with place, from about 4.2 in the far west (longitude -140 to -130) to about 6 between
longitude -120 and -90. It also changes from year to year, from 3.4 in the quiet year 2020 to 7.4 in
2014, and no fixed table of ratios can know that in advance, which is the main source of the error
that remains.

| Calendar month (Canada) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Suomi NPP per MODIS detection | 4.19 | 5.48 | 5.96 | 3.12 | 4.42 | 5.22 | 5.77 | 6.41 | 5.82 | 3.40 | 3.96 | 4.66 |

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
4. From February 2012 to October 2026 it is the Suomi NPP count, unchanged.
5. From November 2026 it is the NOAA-20 count times a handoff ratio, learned the same way from
   April 2018 to October 2025, when both VIIRS satellites flew.

The code is `pipeline/harmonize.py`.

## Validation

We learn on 2012 to 2019 only, apply the result to MODIS for 2020 to 2025, and compare with what
Suomi NPP really reported in those years. The error is the median absolute percentage error: 18%
means the typical total is 18% away from the observed one. "Raw" is the MODIS count with nothing done
to it. Totals with fewer than 20 Suomi NPP detections are left out, because a percentage of a handful
of detections is noise.

The ratio method on its own (`python pipeline/validate.py`):

| Country | Monthly, raw | Monthly, ratio method | Months | Yearly, raw | Yearly, ratio method | Years |
|---|---|---|---|---|---|---|
| Brazil | 69.8% | 6.3% | 72 | 72.9% | 3.8% | 6 |
| Canada | 79.9% | 18.1% | 72 | 80.8% | 9.9% | 6 |
| India | 81.7% | 9.7% | 72 | 82.4% | 1.5% | 6 |
| All three | 77.7% | 10.6% | 216 | | | |

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
region-months, 1,239 block-years). These comparison numbers came from a one-off script and are not
yet reproduced by `validate.py`.

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
the same 1 degree block that MODIS did see, so the model's totals include them.

A model either predicts the Suomi NPP count directly ("count") or predicts Suomi NPP detections per
MODIS detection and multiplies back ("rate"). It is learned either from every country at once
("shared") or from one country's own cell-months ("per-country").

## Which method each country uses

The rule, fixed before each test was run: a model replaces the ratio method only if, on 2020 to 2025,
it is lower than the ratio method on monthly, yearly and regional totals, and at least 2 points lower
on monthly totals.

It took three rounds to get here.

**Round 1, Canada only.** Twelve versions of one model (two targets, three sets of inputs, two
settings) were compared inside 2012 to 2019. The best, a count model with every input, then sat the
2020 to 2025 test against the ratio method: 13.5% monthly, 1.6% yearly and 14.6% for regions, against
18.1%, 9.9% and 21.1%. It passed.

**Round 2, the same model shared across all three countries.** On 2020 to 2025 it was clearly better
for Canada (13.1% monthly, 1.3% yearly) but worse than the ratio method for India (14.3% monthly against
9.7%) and Brazil (6.9% against 6.3% monthly, 6.6% against 3.8% yearly).

**Round 3, a choice per country.** Five candidates per country: the shared model, and four per-country
models (count or rate, basic or full inputs). Each country's candidate was chosen inside 2012 to 2019,
then that one candidate sat the 2020 to 2025 test once.

Inside 2012 to 2019, one year left out at a time:

| Country | Ratio method (monthly / yearly / regions) | Chosen candidate | Chosen candidate (monthly / yearly / regions) |
|---|---|---|---|
| Brazil | 3.9% / 0.4% / 4.8% | per-country, rate, full inputs | 3.3% / 0.9% / 4.7% |
| Canada | 13.5% / 3.9% / 16.5% | per-country, rate, full inputs | 9.5% / 3.7% / 13.8% |
| India | 8.1% / 6.4% / 8.9% | per-country, count, basic inputs | 7.8% / 3.9% / 7.6% |

On 2020 to 2025:

| Country | Ratio method (monthly / yearly / regions) | Chosen model (monthly / yearly / regions) | Result |
|---|---|---|---|
| Brazil | 6.3% / 3.8% / 6.5% | 6.5% / 6.3% / 6.2% | ratio method |
| Canada | 18.1% / 9.9% / 21.1% | 14.0% / 1.4% / 15.6% | model |
| India | 9.7% / 1.5% / 7.5% | 11.7% / 1.4% / 7.6% | ratio method |

So the app uses Canada's own rate model for Canada, and the ratio method for India and Brazil. That
is `MODEL_FOR` in `pipeline/ml_model.py`. Run the comparison with
`python pipeline/ml_model.py --per-country --test`. The build falls back to the ratio method
everywhere when scikit-learn is not installed.

What the app ships, tested on 2020 to 2025:

| | Monthly | Yearly | 5 degree regions, yearly | Total vs observed |
|---|---|---|---|---|
| All three countries | 9.6% | 1.9% | 9.5% | +1.3% |
| Brazil (ratio method) | 6.3% | 3.8% | 6.5% | |
| Canada (model) | 14.0% | 1.4% | 15.6% | |
| India (ratio method) | 9.7% | 1.5% | 7.5% | |

| Shipped estimate vs Suomi NPP observed | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| Brazil | -6.3% | -3.9% | -0.9% | +3.1% | +3.6% | +11.1% |
| Canada | -1.5% | +0.6% | -1.3% | -0.6% | +16.0% | +1.4% |
| India | -0.7% | +3.9% | -2.3% | -0.2% | +0.4% | +7.1% |

For Canada before 2012, the model gives yearly totals between 0.1% and 11% lower than the ratio
method would (2003: 203,318 against 227,034; 2010: 234,642 against 235,170).

### Honest notes

- **The 2020 to 2025 test has been used more than once.** For Canada, four times: twice in round 1
  (the first run gave 13.1%, 2.2% and 15.5%, then the script turned out not to give the same result
  on every run, and after fixing the row order it gave the numbers above), once in round 2 and once in
  round 3. For India and Brazil, twice: rounds 2 and 3. No model was changed after seeing a test
  result. But round 3 was added because round 2 failed for India and Brazil, so the test did shape
  which question we asked next. Each extra look makes the test a little less of a surprise.
- **Looking good in training did not carry over.** Inside 2012 to 2019 the chosen per-country models
  beat the ratio method clearly for Canada and India and tied it for Brazil (better on months and
  regions, worse on years). On 2020 to 2025 only Canada's held up. Our reading,
  not proven: India's crop fires and Brazil's land-clearing fires recur in much the same places and
  months each year, so a fixed per-place, per-month ratio already fits them well and a model mostly
  adds noise. Canada's forest fire seasons swing much more from year to year, which a model can follow.
- **Canada ships the round 3 model,** even though the round 1 and 2 versions scored slightly better
  on the test (13.5% and 13.1% against 14.0% monthly). Round 3's candidate was the one the procedure
  chose inside 2012 to 2019. Switching to an earlier one now would mean choosing by test score.
- **2024 in Canada is the one year far off (+16%).** In 2024 Suomi NPP also reported about 10% fewer
  hot spots than NOAA-20 over Canada (see the next section), so part of that gap may be Suomi NPP
  itself, not the model. Brazil 2025 (+11%) and India 2025 (+7%) are the next largest.
- **Rebuilds used to give slightly different estimates for 2003 to January 2012** (Yuvi spotted it).
  The build adds up each cell's fire radiative power (FRP) on several threads at once. Each addition
  is rounded a little, so the last digits of a sum depended on the order, by at most about one
  ten-billionth. The model uses those sums as inputs, and that was enough to change it: adding the same
  values in another order changed all 53,872 of Canada's pre-2012 estimates (by up to 88 hot spots in
  a cell and month, and up to 0.8% in a year's total) and moved Canada's monthly test error from 14.0%
  to 14.4%. FIRMS gives FRP to two decimals, so `pipeline/ml_model.py` now rounds each sum to three
  decimals before the model sees it, which removes the noise and changes no real value. It also adds
  up the error figures in a fixed order. Now any order gives identical estimates and errors. The
  numbers in this file are from the published build, made before the fix. With the fix, Canada's 2003
  to 2011 yearly totals move by less than 1%, its test errors become 14.8% monthly, 1.2% yearly and
  15.1% for regions, and India and Brazil do not change. Every country's choice and decision stay the
  same: Canada's model still beats the ratio method by 3.3 points monthly. The lesson: a change too
  small to mean anything moved Canada's monthly test error by almost a point, so gaps that small
  between versions of a model are noise.

## The second handoff: Suomi NPP to NOAA-20

Suomi NPP stopped delivering new data on 2 November 2026. From November 2026 the record continues on
NOAA-20, which carries the same instrument. Both flew together from April 2018, so the difference can
be measured directly.

Over April 2018 to October 2025, Suomi NPP reported 0.997 hot spots for every NOAA-20 hot spot over
Canada, 0.987 over India and 1.011 over Brazil. These are the handoff ratios the app applies, one per
country. (The single `handoff_ratio_noaa20` value in `harmonization.json`, 1.0031, is the three
countries pooled. The spec has room for one number only.)

| Suomi NPP per NOAA-20 detection | 2018 (from April) | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|---|
| Brazil | 1.027 | 1.025 | 1.028 | 1.028 | 0.970 | 1.034 | 0.981 | 1.021 |
| Canada | 1.028 | 0.970 | 0.989 | 0.996 | 0.965 | 1.045 | 0.902 | 0.991 |
| India | 0.968 | 1.012 | 0.998 | 1.005 | 0.969 | 0.980 | 0.954 | 1.003 |

The real 2026 data is now in. October 2026 was the last full month with both satellites:

| October 2026 | Suomi NPP | NOAA-20 | NOAA-20 vs Suomi NPP |
|---|---|---|---|
| Brazil | 183,792 | 182,951 | -0.5% |
| Canada | 5,590 | 5,763 | +3.1% |
| India | 18,683 | 21,413 | +14.6% |

From 1 November 2026 the record is NOAA-20 times the handoff ratio. In the app, Suomi NPP detections
stop on 31 October and NOAA-20 detections start on 1 November, with no gap and no double counting.
India's last overlap month disagreed by much more than its 2018 to 2025 average, so India's record
from November 2026 is the least certain part of it.

## Limits

- A single month in a single region can still be well off. The typical 5 degree region and year is
  about 9.5% away from what Suomi NPP observed across the three countries, and about 15.6% in Canada.
- MODIS before 2012 is assumed to behave like MODIS after 2012. Sensor ageing is not accounted for.
- The 2003 to 2011 estimates cannot be checked directly, because VIIRS did not exist then.
- Only three countries have been tested. Another country would need the same per-country test before
  the app says anything about it.
