# TrainGPT mobile Strava rebuild patch

This patch makes mobile Strava boring and reliable:

- `connected` now means Strava tokens exist in `profiles`.
- Old imported rows no longer make the app think Strava is connected.
- `/api/strava_sync` backfills 90 days when mobile sync is incomplete or forced.
- Sync uses Strava summary activities directly instead of slow per-activity detail calls.
- Adds `/api/strava/disconnect` to clear tokens and imported Strava rows.
- Settings now shows Strava status and lets you disconnect/reset.
- Plan generation Strava connect forces a backfill after OAuth.

Run after applying:

```bash
npm run typecheck
npm run lint
```
