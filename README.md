# rbxProjected-Detector

A Roblox projected detector that uses its own rap DB to detect projections.

The repo **DOES NOT** come with actual item data, you'd need to scrape all the rap history from rolimons.com and save it in a .sqlite file:

db > itemID > ```{LU: 0, unmark_rap: 0, data: []}```

Pretty sure you can run this on anything, uses node workers so it doesn't slow the main process with math;
it opens a port on 9000 and outputs a JSON object of Roblox items values like Rolimons:

**Rolimons** - https://www.rolimons.com/itemapi/itemdetails

**Used format** - ```[item_name, acronym, rap, value, default_value, demand, trend, projected, hyped, rare, avg RAP before projection]```
