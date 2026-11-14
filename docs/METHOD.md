# Method: how Pyronac harmonizes MODIS and VIIRS hot spots

Status: Saturday 14 November 2026. Numbers are for Canada, from NASA FIRMS yearly files:
MODIS 2003 to 2025, VIIRS on Suomi NPP 2012 to 2025, VIIRS on NOAA-20 2018 to 2025.
Not yet in the data: 2026. Until it is, the NOAA-20 handoff is measured but not yet applied to a real month.

## The problem in one table

Counting hot spots as the satellites reported them, Canada's fire record jumps fivefold between 2011
and 2012. Nothing changed on the ground. The record switches from MODIS (1 km pixels) to VIIRS (375 m
pixels), and VIIRS sees several hot spots where MODIS sees one.

| Year | Raw record | Harmonized record |
|---|---|---|
| 2009 | 25,814 | 114,016 |
| 2010 | 44,923 | 232,811 |
| 2011 | 33,224 | 170,257 |
| 2012 | 169,914 | 170,655 |
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
4. From February 2012 to October 2026 it is the Suomi NPP count, unchanged.
5. From November 2026 it is the NOAA-20 count times a handoff ratio, learned the same way from
   April 2018 to October 2025, when both VIIRS satellites flew.

The code is `pipeline/harmonize.py`.

## Validation

We learn the ratios on 2012 to 2019 only, apply them to MODIS for 2020 to 2025, and compare with
what Suomi NPP really reported in those years. The error is the median absolute percentage error:
18% means the typical total is 18% away from the observed one. "Raw" is the MODIS count with nothing
done to it. Totals with fewer than 20 Suomi NPP detections are left out, because a percentage of a
handful of detections is noise. Run it with `python pipeline/validate.py`.

| Country | Monthly, raw | Monthly, harmonized | Months | Yearly, raw | Yearly, harmonized | Years |
|---|---|---|---|---|---|---|
| canada | 79.9% | 18.1% | 72 | 80.8% | 9.9% | 6 |

| Country | Year | MODIS, raw | Harmonized estimate | Suomi NPP, observed | Estimate vs observed |
|---|---|---|---|---|---|
| canada | 2020 | 11,033 | 39,344 | 37,262 | +5.6% |
| canada | 2021 | 83,292 | 476,488 | 430,732 | +10.6% |
| canada | 2022 | 29,337 | 165,226 | 151,415 | +9.1% |
| canada | 2023 | 280,489 | 1,459,138 | 1,641,678 | -11.1% |
| canada | 2024 | 127,920 | 751,147 | 669,543 | +12.2% |
| canada | 2025 | 132,777 | 769,460 | 841,557 | -8.6% |

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
yet reproduced by `validate.py`.

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
| Raw MODIS | 79.9% | 80.8% | 79.2% | |
| Ratio method | 18.1% | 9.9% | 21.1% | -3.0% |
| ML model | 13.5% | 1.6% | 14.6% | +2.6% |

| Year | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| ML estimate vs Suomi NPP observed | -1.9% | +1.7% | -1.5% | -0.7% | +14.8% | +0.7% |

Honest notes on this result:

- The first run of the test gave 13.1%, 2.2% and 15.5%. The script then turned out not to give
  identical results on every run, because the rows reached the model in no fixed order. After fixing
  the order, the numbers are the ones in the table, and a rebuild now gives the same answer every time.
  So the test years were run twice, with the same version and no change to the method.
- 2024 is the one year that is far off. In 2024 Suomi NPP also reported about 10% fewer hot spots
  than NOAA-20 (see the next section), so part of that gap may be Suomi NPP itself, not the model.
- For 2003 to 2011 the model gives totals 3% to 12% lower than the ratio method, depending on the year.

Run the comparison with `python pipeline/ml_model.py` (add `--test` for the final test). The build
uses the model when scikit-learn is available and falls back to the ratio method when it is not.

## The second handoff: Suomi NPP to NOAA-20

Suomi NPP stopped delivering new data on 2 November 2026. From November 2026 the record continues on
NOAA-20, which carries the same instrument. Both flew together from April 2018, so the difference can
be measured directly.

Over April 2018 to October 2025, Suomi NPP reported 0.997 hot spots for every NOAA-20 hot spot over
Canada. Month by month the two differ more than that: the typical monthly total is 3.2% apart (91
months), and whole years range from 0.90 (2024) to 1.05 (2023).

| Year | 2018 (from April) | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|---|
| Suomi NPP per NOAA-20 detection | 1.028 | 0.970 | 0.989 | 0.996 | 0.965 | 1.045 | 0.902 | 0.990 |

So the handoff ratio is close to 1 and is applied the same way as the MODIS ratio, as one number per
country. This part has not yet been run on a real month after the handoff, because the 2026 data has
not arrived.

## Limits

- A single month in a single region can still be well off. The typical 5 degree region and year is
  about 15% away from what Suomi NPP observed.
- MODIS before 2012 is assumed to behave like MODIS after 2012. Sensor ageing is not accounted for.
- The 2003 to 2011 estimates cannot be checked directly, because VIIRS did not exist then.
- Tested on Canada only so far.
