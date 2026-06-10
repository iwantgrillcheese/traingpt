# Batch 5 — Systematic Design Unification + the Adaptive Loop's UI

## What this batch does

1. **gray → zinc sweep: 289 legacy class instances across 23 files.** The app
   had 1,045 zinc-* classes and 289 gray-* stragglers (WeeklyIntentCard, race
   hub, coach chat, settings, etc.). Everything now speaks one palette. The two
   are visually near-identical in Tailwind, so this is consistency, not a
   redesign — but mixed-palette screens (race hub, coaching panels) will look
   subtly cleaner.
2. **Orange deliberately untouched.** Audit finding: every remaining orange is
   semantic — Bike's sport color (consistent across all dashboards) and Strava
   brand badges. That's a system, not a fight.
3. **CoachUpdateCard on /schedule** (new) — the visible half of the adaptive
   loop:
   - During post-generation enrichment: "Detailing your plan — week 4 of 16"
     with a live pulse, driven by Batch 1's window events.
   - After the Sunday cron: the coach's summary + an expandable structured diff
     (Long Ride · 180min → 150min, with the reason under each change).
   - Renders nothing when there's nothing to say.
4. **Hero swap to the adaptive claim** — "A plan that adapts every week to what
   you actually did." ONLY merge this batch after Batch 4 is deployed; the
   headline must describe a live feature.
5. **lib/design-system.ts deleted** — zero importers, dead code (see apply
   commands).

## Files

- `app/components/CoachUpdateCard.tsx` (NEW)
- `app/schedule/page.tsx` (modified — sweep + card mount above CalendarShell)
- `app/page.tsx` (modified — sweep + hero; built on Batch 1's version)
- `components/PlanReadyReviewOverlay.tsx` base = Batch 2's version (no gray
  found; listed for completeness of the base-resolution rule)
- 22 further sweep-only files (full list = the zip contents)

All modified files were generated from the post-Batch-1/2 state of your repo,
so they drop in cleanly on top of tonight's branches.

## No migrations, no env, no new deps.

(CoachUpdateCard reads plan_adaptations via the RLS select policy created in
Batch 4's migration.)

## Verify

```
yarn verify
```

Visual QA matters most for this batch — click through: /schedule (card area +
calendar), /race, /races, /settings, /coaching, coach chat modal. You're
looking for anything that looks BROKEN (spacing/contrast), not for taste.
Generate a fresh plan to see the "Detailing your plan" pulse on /schedule.

## Rollback

Revert the commit. Sweep changes are pure classname substitutions.
