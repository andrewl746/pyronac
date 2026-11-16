# How Pyronac works

## The problem

NASA spots fires from orbit with two kinds of instruments:

- **MODIS** has flown since 2000. Its pixels are 1 km across.
- **VIIRS** has flown since 2012. Its pixels are 375 m across, so it sees smaller fires and reports
  about 4 to 6 hot spots for every one MODIS reports.

If you just count hot spots, every country's fire record jumps in 2012 even though nothing changed
on the ground. Canada goes from 33,224 hot spots in 2011 to 169,914 in 2012 and 311,138 in 2013.
That makes it impossible to compare a fire season from 2005 with one from 2023. Pyronac fixes this
so the whole record from 2003 to today is on one scale.

## The fix

We put everything on the VIIRS scale. For every place and month before 2012, Pyronac estimates how
many hot spots VIIRS would have reported if it had been flying. We tried two ways of doing that.

**1. A ratio.** For the years both instruments flew, we count how many VIIRS hot spots there were
for each MODIS one, separately for each 1 degree block of the map (about 100 km) and each calendar
month, then multiply the old MODIS counts by that ratio. One number for the whole country is not
enough: in Canada the ratio runs from about 3.2 in April to 6.4 in August.

**2. A machine learning model.** The ratio also changes from year to year (in Canada, 3.4 in 2020
but 7.4 in 2014), and a fixed table can't follow that. So we trained a gradient boosting model
(scikit-learn) to predict the VIIRS count of each grid cell and month. It only uses things MODIS
measures: the cell's hot spot count and fire intensity, its neighbours, day against night, which
satellite saw it, the month and the location. That is what lets it work on years before VIIRS existed.

We wrote down the rule before running the final test: the model only replaces the ratio if it does
better on monthly, yearly and regional totals, and at least 2 points better on monthly ones. It
passed in Canada. In India and Brazil the simple ratio held up, probably because crop burning and
land clearing happen in much the same places and months every year. So the app uses the model for
Canada and the ratio for India and Brazil.

## Does it work?

We trained on 2012 to 2019 only. Then we took MODIS data for 2020 to 2025, estimated what VIIRS
should have seen, and compared that with what VIIRS actually saw.

| How far off, typically | Monthly totals | Yearly totals |
|---|---|---|
| Raw MODIS, nothing done | 78.5% | 73% to 82%, by country |
| **Pyronac, all three countries** | **9.2%** | **2.6%** |
| Canada (model) | 14.8% | 1.3% |
| India (ratio) | 10.0% | 2.5% |
| Brazil (ratio) | 5.2% | 5.3% |

VIIRS can't check the years before 2012, so we also checked those years in Canada against something
the satellites don't measure: the area burned each year, from Canada's National Forestry Database.
Hot spots per square kilometre burned should not jump when the satellites change. In the raw counts
they jump 5.6 times across 2012. After harmonizing the jump is 1.25 times. Most of the false jump is
gone, but this check suggests the pre-2012 estimates may still be 15 to 21% too low.

## The second handoff

The VIIRS on the Suomi NPP satellite stopped delivering data on 2 November 2026. The record now
continues on NOAA-20, which carries the same instrument. Both flew together from April 2018, so we
measured the difference directly: Suomi NPP reports about 1.02 hot spots for every NOAA-20 one. We
checked that on January to October 2026, months the ratio wasn't learned from, and it was within 2.4%
to 3.7% (median) depending on the country.

## Cleaning the data

- **Missing days.** On some days Suomi NPP sent almost no data while NOAA-20 kept seeing fires: 53
  days in Canada since 2018. A day with no data isn't a day with no fire, so we fill those days from
  NOAA-20. In Canada that adds 60% to July 2026.
- **Factories and gas flares.** The newest NASA files don't say which hot spots are industrial heat.
  We drop spots that the older, labelled files mostly mark as industrial. In India's quiet months
  that heat made the count 26% to 216% too high. With the filter it's 1% to 6% off.

## The fire base planner

Pyronac also suggests sites in Canada for small fire bases (drones plus a helicopter crew). It looks
at summer fires (June to August) within 50 km of a town of 500 or more people, then places bases one
at a time, each where it covers the most fire the earlier bases don't.

To test it, we picked sites using only 2003 to 2015, then checked how much of the fire near towns in
2016 to 2025 they would have reached. 25 bases with a 100 km reach covered 67% of it. 25 random fire
sites covered 23%.

It covers Canada only. In Punjab most hot spots are crop burning, and in the southern Amazon most
are fires set to clear land, so a fire base isn't the answer there. The sites are places to study,
not a plan: the data doesn't know about roads, water or land cover.

## Limits

- A single month in a small area can still be well off. For a typical 5 degree region and year,
  Canada's estimates are about 15% away from what VIIRS saw.
- We assume MODIS behaved the same way before 2012 as after. We can't check that against VIIRS.
- Only Canada, India and Brazil have been tested.
