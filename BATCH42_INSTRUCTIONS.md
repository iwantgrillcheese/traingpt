# Batch 4.2 — Dormancy Guard (from the production dry-run review)

The full-userbase dry-run revealed the engine treating ABANDONMENT as
STRUGGLE: 0%-compliance users (people not using the app) were getting full
reset-week rewrites — which would also re-trim 20% every silent week, slowly
shrinking unwatched plans toward the floor.

## Change (utils/adaptNextWeek.ts — replaces 4.1's version)
New Rule 0.5: a completely silent week (zero completions from any source)
returns NO structural changes and a warm re-engagement summary ("Last week
didn't happen — life does that sometimes...") instead of a guilt ledger.
Reset/trim rules now apply only to athletes who showed up partially (1+
completions). Race-week rule still takes precedence.

Certified by sim: dormant 0/8 -> no changes; partial 2/8 -> full reset fires.

## What this means for Sunday's first live run
Given current data (everyone at 0% or legacy plans), Sunday will be
summary-only for the entire user base: zero plan rewrites, every user gets a
personalized coach line in the weekly email. The safest possible first run —
the engine's first real rewrites will happen for the first athlete who
partially completes a week.

## Verify
yarn verify, deploy, re-run the dry-run: every 0/X user should now show
"changes": [] with the re-engagement summary.
