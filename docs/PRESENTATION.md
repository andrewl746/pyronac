# Presentation summary: Pyronac, the fire almanac

A one-page aid for the pitch, in three parts: emotional benefit, functional benefit, product
features. Written Sunday 15 November 2026 from `docs/METHOD.md`, `docs/DATA_NOTES.md` and the app
running on the final data release (data through 14 November 2026).

Every number here is the team's own. The "Source" column says where each one comes from, so anyone
can check it before it goes on a slide.

Words used below:

- **Hot spot:** one satellite image pixel where the instrument detected fire.
- **MODIS:** the older instrument, since 2000. Pixels about 1 km wide.
- **VIIRS:** the newer instrument, since 2012. Pixels 375 m wide. It reports about five hot spots
  where MODIS reports one.
- **Raw record:** the count as the satellite of the time reported it. MODIS before February 2012,
  VIIRS after.
- **Harmonized record:** every month converted to the VIIRS scale.

## 1. Emotional benefit

The team tells this story in its own words. The table gives the questions to answer and the facts
from our data that can support the story.

| Question for the story | Facts from our data that support it | Source |
|---|---|---|
| Who makes decisions with this record? | Fire managers ask "is this month normal here, or is it getting worse?" The app answers that for any area. | The compare panel |
| What goes wrong today? | The instrument changed in 2012 and the raw count jumped about fivefold, with no change on the ground. | `docs/METHOD.md`, "The problem in one table": Canada 33,224 in 2011, 169,914 in 2012 |
| What does a bad season look like? | July 2023 in the Northwest Territories had 1,341% more hot spots than a usual July there. | The app, Northwest Territories preset, July 2023 |
| Can the old record mislead? | In the southern Amazon area the raw record shows fire rising. The harmonized record shows it falling. | `/api/trend`, Southern Amazon preset |
| What value do we stand for? | Honest evidence. A community should not get the wrong picture of its fire risk because a satellite was replaced. | The team's position |

Facts from outside the project (for example the Yellowknife evacuation in August 2023) need a news
or government source before they go on a slide.

## 2. Functional benefit

The claim: one fire record that can be compared across 23 years, with a measured error.

| Benefit | Raw record | Pyronac | Source |
|---|---|---|---|
| Error of a typical monthly total | 78.5% | 9.2% | `docs/METHOD.md`, "In short". Learned on 2012 to 2019, tested on 2020 to 2025, three countries. |
| Error of a typical yearly total | not reported | 2.6% | Same test |
| Same test, by country (monthly, yearly) | | Canada 14.8%, 1.3%. India 10.0%, 2.5%. Brazil 5.2%, 5.3%. | `docs/METHOD.md`, "What the app ships" |
| False jump across 2012, Canada | 5.6 times | 1.25 times | `docs/METHOD.md`, outside check against area burned |
| Trend, all of Canada, 2003 to 2025 | +129% per decade | +84% per decade | `/api/trend`, All of Canada preset |
| Trend, southern Amazon | +48% per decade, rising | 36% per decade, falling | `/api/trend`, Southern Amazon preset |
| Years of usable history | 14 (VIIRS alone, 2012 to 2025) | 23 (2003 to 2025) | Data coverage |
| Record after Suomi NPP stopped (2 Nov 2026) | ends | continues on NOAA-20 | For January to October 2026, NOAA-20 scaled by Pyronac was a median 2.8% (Brazil), 3.7% (Canada), 2.4% (India) from what Suomi NPP observed. `docs/METHOD.md`, "The second handoff" |
| Size of the record | | 42.7 million detections, three countries | Final data release notes |
| Time to show an area's full history | | under 2 seconds | One run on one laptop, three presets. Not a formal test. |

What we cannot claim:

| Do not say | Why |
|---|---|
| A figure for money or hours saved | The team has not measured either. We can describe the work Pyronac replaces: download 153 files (about 5.6 GB) from NASA, clean them, and build a conversion between the two instruments. |
| Harmonizing improves where the fire bases go | The team's test found no difference: sites chosen from the harmonized, raw and VIIRS-only records reached 33%, 35% and 34% of later fire. |
| The early years are exact | The estimates for 2003 to 2011 in Canada are probably 15 to 21% too low, by the check against area burned. |

## 3. Product features

### How the data was harmonized

| Step | What the pipeline does |
|---|---|
| 1. Collect | Takes NASA FIRMS fire detections from MODIS, and from VIIRS on the Suomi NPP and NOAA-20 satellites, for Canada, India and Brazil. |
| 2. Clean | Removes low-confidence detections and non-fire sources such as industrial sites. |
| 3. Count | Counts detections per month in squares of 0.1 degree, about 11 km. |
| 4. Learn | From 2012 both instruments saw the same fires. Those years show how a MODIS count relates to a VIIRS count. |
| 5. Convert | For 2003 to January 2012, estimates what VIIRS would have counted. A machine learning model for Canada, a ratio per area and calendar month for India and Brazil. Each country uses the method that tested better. |
| 6. Keep | From February 2012 the record is the Suomi NPP count as observed. Days when Suomi NPP sent almost nothing are filled from NOAA-20. |
| 7. Continue | From November 2026 the record is the NOAA-20 count times a measured ratio close to 1. |
| 8. Test | Learns on 2012 to 2019 and tests on 2020 to 2025, years the method never saw. |

To show it live: flip the Harmonized or Raw switch on the calendar. In Raw the years before 2012
look almost empty. In Harmonized they fill in.

### What the user can do

| Feature | What it gives |
|---|---|
| Pick an area | A preset, typed coordinates, or a drawn box, in Canada, India or Brazil. |
| Fire calendar | Hot spots by month and year, 2003 to today, with a legend in real counts. |
| Harmonized or Raw switch | Shows the 2012 jump and removes it. |
| Compare with other years | A month against the same month in every other year, in one sentence and one chart. |
| Range of the estimate | The likely range for months before February 2012. |
| Anomaly map | Each cell coloured by how unusual the selected month is. |
| Trend map | Each cell coloured by how its yearly count has changed, with the area's trend in both records. |
| Time-lapse | Plays the months on the map. |
| Fire base planner | Suggested sites for fire bases in Canada. With 25 bases, sites chosen from 2003 to 2015 reached 67% of the 2016 to 2025 fire near towns, against 23% for random sites. |
| Downloads | Hot spots and the calendar as CSV files, charts as images, and a one-page printed briefing. |
| Accessibility | Works by keyboard. Colour ramps readable with colour vision deficiency. Every value is also given as a number. |

Before presenting: open each feature on the current build. The layout changed on Saturday night,
and this list was last checked feature by feature on Saturday afternoon.
