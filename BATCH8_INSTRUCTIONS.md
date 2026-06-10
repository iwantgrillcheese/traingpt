# Batch 8 — iOS Parity (Expo app)

The first mobile batch of the night. Fixes the regression Batch 1 created for
phone-generated plans and brings the adaptive loop to the primary daily surface.

## Changes

**Plan enrichment on mobile** (NEW mobile/src/utils/enrichPlan.ts + PlanScreen.tsx)
Batch 1 made /api/finalize-plan return scaffold-instantly with enrichment driven
by the client — but only web had a runner, so iOS-generated plans were never
enriched. PlanScreen now kicks off the same sequential /api/enrich-week loop
after generation completes. Plan is usable immediately; details upgrade in the
background while the app is open. App closed mid-run = remaining weeks keep
their (complete, executable) scaffold details.

**Coach update on Today** (NEW mobile/src/components/CoachUpdateCard.tsx + TodayScreen.tsx)
The Sunday adaptation summary + expandable diff now appears at the top of the
Today screen, themed to the existing mobile design system (topography accent).
Reads plan_adaptations via the RLS policy from Batch 4. Renders nothing when
there is nothing to say.

**Strava matching unified** (mobile/src/utils/stravaMatching.ts — replaced)
Was: same day + same sport = completed. Now mirrors web semantics: when the
planned session has a duration, the activity's moving time must be within a
±60% tolerance — a 15-minute spin no longer completes a 2-hour long ride.
Weight training / crossfit activities now match Strength sessions. Same
exported signature; no call-site changes. (Full cross-client unification
belongs server-side later; this removes the worst divergence now.)

**Daily email toggle in Settings** (mobile/src/screens/SettingsScreen.tsx)
Native Switch wired to profiles.daily_email_opt_in — same control web got in
Batch 6, so the daily loop is manageable from the phone.

## Files (6)
- mobile/src/utils/enrichPlan.ts (NEW)
- mobile/src/components/CoachUpdateCard.tsx (NEW)
- mobile/src/utils/stravaMatching.ts (REPLACED)
- mobile/src/screens/PlanScreen.tsx (modified)
- mobile/src/screens/TodayScreen.tsx (modified)
- mobile/src/screens/SettingsScreen.tsx (modified)

## No migrations, no env, no new deps. Depends on Batch 2's SQL + Batch 4's table.

## Verify
Web `yarn verify` does NOT cover mobile/. From the repo root:

    cd mobile && npx tsc --noEmit

Then run it live: `npx expo start`, open in Expo Go / dev build:
1. Generate a plan from the phone -> instant; watch session details upgrade
   over the next minute (pull-to-refresh Today/Schedule).
2. Today screen shows the Coach update card if a plan_adaptations row exists
   from the last 8 days (run the adapt-week cron with ?user=<you> to seed one).
3. Settings -> flip the Daily session email switch -> confirm profiles row.
4. A short Strava activity on a long-ride day should no longer mark it done.

## Ship note
Unlike the web batches, this reaches users via an Expo build (TestFlight /
EAS Update), not the Vercel deploy. If you're on EAS Update with JS-only
changes, `eas update` pushes this without an App Store review cycle.
