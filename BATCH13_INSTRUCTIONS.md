# Batch 13 — Expired-Race Banner (Monday-clicker path)

Many of Monday's re-engagement recipients signed up months ago; their race
dates have passed. Without this, "your plan is right where you left it"
lands them on a plan pointed at the past.

## Changes
- app/schedule/CalendarShell.tsx: when the plan's race_date is before today,
  a banner renders under the header — "Your {race} has passed. The coach is
  still here — point it at your next race..." with a "Plan my next race"
  button to /plan. (Matches the batch-10 guard banner's visual language.)
- app/schedule/page.tsx: passes raceDate (already fetched) down to the shell.

IMPORTANT BASE NOTE: page.tsx here is built on the Batch 5 copy. If anything
else touched app/schedule/page.tsx since (it shouldn't have — no batch or the
redesign patch did), run `git diff` after unzip and eyeball before committing.

## Verify
yarn typecheck. To see it: temporarily set your plan's race_date to yesterday
in Supabase, load /schedule, then set it back. Logged-out path check still
yours: email link -> login -> should land on /schedule.
