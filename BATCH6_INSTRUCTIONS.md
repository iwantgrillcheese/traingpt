# Batch 6 — De-amateuring Pass (systematic UI fixes)

Implements the screenshot-critique findings. Three principles drove every edit:
one home per number, type over boxes, no off-system colors.

## Changes

**Session modal** (`app/schedule/SessionModal.tsx`)
- The four nested PURPOSE/WORKOUT/INTENSITY/COACH NOTE boxes are now one
  typographic block: small-caps labels, comfortable line height, zero borders.
- The duplicated "Generate with Plus" CTA is gone from the footer — one CTA,
  in context, next to what it generates. Footer keeps Delete / Close.

**Schedule** (`app/schedule/CalendarShell.tsx`, `app/schedule/DayCell.tsx`)
- "0/8 sessions complete · 7h 2m planned · 0% adherence" no longer appears
  twice. The sub-header keeps only the phase line; the This Week panel owns
  the numbers.
- This Week's three bordered mini-cards became hairline stat rows.
- "+ Add" is invisible until you hover the day cell (was 70% opacity in every
  empty cell — ~15 dashed buttons on screen at once).

**Coaching** (`app/components/CoachingPointsDashboard.tsx`)
- The forest-green hero — the only saturated block in the product — is now
  zinc-950. Progress bar white-on-ink.
- "Bank 306 points" → "Points this week". The defensive "Points are not
  fluff" sentence is deleted (if you have to say it, the UI failed; now it
  doesn't have to say it).
- "Mission plan" → "Up next" (one vocabulary, the coach's).
- Up next cards no longer render session details as a paragraph blob: a new
  SessionDetailLines component splits Purpose / Workout / Intensity / Coach
  note / Adaptation into labeled lines.

**Settings** (`app/settings/page.tsx`)
- Blue "Manage Subscription" → zinc-950 pill. Last off-system button removed.
- Strava's "Connected" badge now uses the same emerald state style as Oura's
  (state gets state color; Strava orange remains for brand contexts like the
  connect button, not for status).
- NEW: "Email me each morning I have a session" toggle, wired to
  `profiles.daily_email_opt_in` — the plan-ready overlay is no longer the only
  place to control the daily email.

## Files (7)
- app/schedule/SessionModal.tsx
- app/schedule/CalendarShell.tsx
- app/schedule/DayCell.tsx
- app/components/CoachingPointsDashboard.tsx
- app/settings/page.tsx  (built on Batch 5's swept copy — apply after Batch 5)
- (OuraConnectionCard inspected, already correct — untouched)

## No migrations, no env, no new deps.

## Verify

```
yarn verify
```

Visual QA: open a session modal (boxes gone, one CTA), /schedule (stats appear
once, hover an empty day cell for + Add), /coaching (ink hero, labeled Up next
cards), /settings (toggle the daily email and confirm the profiles row flips).

## Deliberately deferred (needs live iteration, not blind edits)
- Race Readiness "15/100" day-one punishment + the Readiness-vs-Fitness 100/100
  contradiction — product decision: likely hide readiness until week 2 data.
- Weekly review prose restating the stat row — needs the summary generator
  reworked, not a classname.
- The Settings nav item's harsh outline — likely a focus style in Layout.tsx;
  want a screenshot of it in DOM inspector before touching global focus rules.
