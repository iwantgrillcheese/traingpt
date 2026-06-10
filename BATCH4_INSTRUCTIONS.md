# Batch 4 — Adaptive Week v1 (the moat)

## What this batch does

Every Sunday at 20:00 UTC — one hour before the weekly email — the plan looks
at what actually happened and rewrites next week:

**Inputs:** planned sessions for the week that just ended, completion from three
sources (sessions.status = 'done', manual completed_sessions rows, Strava match
via the same mergeSessionsWithStrava the web app uses), and anchor/key priority
from the scaffold metadata persisted in Batch 1.

**Rules (deterministic, in utils/adaptNextWeek.ts — no LLM in the decision loop):**
1. Never increase load in response to missed training.
2. Missed Long Ride / Long Run → next week's matching anchor repeats the missed
   progression instead of building past a session that didn't happen.
3. Compliance < 50% → reset week: ~15–20% volume trim, quality sessions become
   endurance.
4. Compliance 50–80% (or a missed anchor) → one quality session downgrades to
   endurance; everything else holds.
5. Race week untouchable; deload weeks only get the anchor-repeat rule.

**Outputs:** plan JSON updated, sessions rows updated (duration/title/details,
with an "Adaptation: <reason>" line appended), and a plan_adaptations row with
the structured diff + a plain-language summary. A row is written EVERY week even
with no changes ("You completed 6 of 7 sessions — next week runs as planned"),
so every athlete gets a personalized coach line.

**The weekly email becomes a re-plan, not a recap:** the upcoming-week email's
note section now carries the adaptation summary when one exists from the last
3 days, falling back to the old generic text.

## Files

- `utils/adaptNextWeek.ts` (NEW — pure rules engine, unit-testable)
- `app/api/adapt-week/route.ts` (NEW — Sunday cron, ?dry=1 and ?user=<uuid> for testing)
- `lib/emails/UpcomingWeekEmail.tsx` (modified — coachNote prop)
- `lib/emails/generateUpcomingWeekEmail.tsx` (modified — passes coachNote)
- `lib/emails/send-upcoming-week-email.ts` (modified — forwards coachNote, previously dropped)
- `app/api/send-email/upcoming-week/route.ts` (modified — fetches latest adaptation summary)
- `vercel.json` (modified from Batch 3's version — adds the 20:00 Sunday cron)

## REQUIRED: SQL migration (Supabase SQL editor, before deploy)

```sql
create table if not exists public.plan_adaptations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null,
  week_index int not null,
  week_start date not null,
  compliance numeric,
  changes jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  unique (plan_id, week_index)
);

alter table public.plan_adaptations enable row level security;

create policy "read own adaptations"
  on public.plan_adaptations for select
  using (auth.uid() = user_id);
```

(The cron writes with the service role, which bypasses RLS; the select policy is
for the future web UI diff card.)

## Verify

```
yarn verify
```

Then DRY-RUN against yourself before anything writes:

```
/api/adapt-week?secret=CRON_SECRET&dry=1&user=<your-user-uuid>
```

Inspect the JSON: compliance, missedAnchors, changes, summary. Sanity-check the
decisions against what you actually trained last week. When it looks right, run
without dry=1 for your user only, then check /schedule — adapted sessions show
the new duration/title and an "Adaptation:" line in details, and Supabase has
the plan_adaptations row.

## Notes / known v1 limits

- Decisions are timezone-referenced to America/Los_Angeles (DAILY_EMAIL_TIMEZONE
  to override) — same v1 simplification as the daily email.
- Duration text inside the Workout: line of details may briefly disagree with a
  reduced durationMinutes (the appended Adaptation line explains why). The
  enrichment pass can re-polish adapted weeks in v2.
- Oura readiness is not yet an input — completion data only for v1. Readiness
  joins in v2 once we trust the loop.
- Web diff card on /schedule is the follow-up surface; v1 lands the summary in
  the weekly email and session details.
