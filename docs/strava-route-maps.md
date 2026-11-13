# Run and ride route maps

The schedule activity modal and the matched-session modal share `ActivityRoute`.
When Strava returns a GPS summary polyline, `ActivityStreetMap` lazy-loads Leaflet,
fits the full route, draws the orange track and start/finish markers, and permits
pan/zoom. Mouse-wheel zoom is disabled so the workout modal remains scrollable.

**Fallbacks:** Indoor, manual, and GPS-less activities retain the text fallback.
If the map library fails to initialize, tiles error, or the tile server doesn't
return a tile within 12 seconds, the previous self-contained SVG route is shown.
The authenticated Strava activity-route API is unchanged.

## Tile source and attribution

- Default: standard OpenStreetMap raster tiles, with visible OSM attribution.
  This is acceptable for modest interactive usage, subject to the
  [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
  The public OSM service is community-funded, best-effort and **not suitable
  as a guaranteed map backend for commercial scale**. Never bulk-prefetch tiles.
- For a supported provider, set `NEXT_PUBLIC_CARTO_BASEMAP_KEY` in Vercel.
  The viewer then uses CARTO Voyager tiles and adds both CARTO and OSM
  attribution. The key is client-exposed by design; use a project-specific key.
  CARTO's current basemap terms permit limited commercial use at no charge,
  subject to its stated limits and attribution requirements.
- Before materially scaling map traffic, use a provider account with usage
  limits, monitoring, and terms appropriate to the paid product.

The map only loads after the athlete opens a route; tiles reveal the visible
map extent to the map provider, not the Strava access token or the full
activity GPS polyline. The app must not log or expose Strava OAuth credentials.

## QA

1. Open a GPS run and a GPS ride from the standalone calendar, desktop and mobile.
2. Open a matched run or ride; ensure its route works with the same shared component.
3. Confirm tile attribution remains visible, the whole route fits, map panning and
   zoom buttons work, and scrolling the surrounding modal still works.
4. Check indoor ride, GPS-less run and swim for appropriate empty-route behavior.
5. Simulate map tile failures and verify the existing SVG route replaces the map.
6. Open a different activity immediately and confirm the route never flashes
   the previous athlete's GPS track.
