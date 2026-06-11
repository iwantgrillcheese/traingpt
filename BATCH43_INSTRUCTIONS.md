# Batch 4.3 — Skipped ≠ Completed (cron input fix)

adapt-week built its completion set from completed_sessions presence alone,
but that table stores both 'done' AND 'skipped' rows — so explicitly skipped
sessions counted as completed work, inflating compliance.

## Change (app/api/adapt-week/route.ts — replaces Batch 4's version)
The completed_sessions query now selects status, and rows with
status = 'skipped' are excluded from the completion set. Sessions-table
status and Strava matching unchanged.

Invisible at today's data volume; matters the moment athletes start marking
sessions — i.e., this week.

## Verify
yarn verify, deploy, re-run dry-run. (To prove it: mark a session skipped on
your own account and confirm your completedCount does not increment.)
