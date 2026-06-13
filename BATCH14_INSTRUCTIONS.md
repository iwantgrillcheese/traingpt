# Batch 14 — Planned Duration Is Immutable

Bug: mergeSessionWithStrava replaced session.duration (the PLAN) with the
matched activity's actual moving time. The modal showed "Planned 1h 10m" for
a 55-minute session, and "Plan vs actual: On target" was a tautology. DB was
never touched — display-layer only. The adaptation engine was verified
unaffected (matching decides before the overwrite; the cron reads DB rows).

## Changes
- utils/mergeSessionWithStrava.ts: duration now ALWAYS means planned; new
  completedDurationMinutes field carries the actual when matched. Type
  comments updated to make the contract explicit.
- app/schedule/MobileCalendarView.tsx: completed cards keep displaying the
  actual (now read from the activity, like DayCell already did).

Heals automatically, no edits needed: SessionModal "Planned" label, Plan vs
actual comparison (Completed already read stravaActivity.moving_time),
CalendarShell weekly Volume (now true planned volume), DayCell (already read
the activity directly).

## Verify
yarn typecheck. Open your Thursday Bike Endurance: Planned should read 55m,
Completed 1h 10m, and Plan vs actual should finally have an opinion.
