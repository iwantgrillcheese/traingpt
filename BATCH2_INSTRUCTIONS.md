# Batch 2 — Commitment Close

## What this batch does

The post-generation "Plan ready" overlay now ends with a commitment instead of a
scroll: a dark hero card showing the athlete's FIRST upcoming session ("Tue, Jun 16 —
Long Ride · 2h") and a pre-checked opt-in: "Email me each morning I have a session."
The preference persists to `profiles.daily_email_opt_in` when the overlay closes
(any path: ×, Go to schedule, Ask coach) and fires a `daily_email_opt_in_set`
PostHog event so we can measure opt-in rate.

This is the demand-side half of the daily loop. Batch 3 (the cron that actually
sends the morning email) consumes the same column.

## Files

- `components/PlanReadyReviewOverlay.tsx` (modified — anchored edits on your
  current source: new state, first-upcoming-session selector, persistence on
  close, commitment section UI in the existing zinc design system)

## REQUIRED: one SQL migration (run in Supabase SQL editor before deploying)

```sql
alter table public.profiles
  add column if not exists daily_email_opt_in boolean not null default false;
```

Default false = existing users are NOT silently subscribed; only athletes who go
through the plan-ready moment (or a future settings toggle) get the daily email.

## Verify

```
yarn verify
```

Smoke test: generate a plan → overlay shows the first session card with the
checkbox → close → confirm in Supabase that your profile row has
`daily_email_opt_in = true`. Uncheck → close → confirm false.

## Rollback

Revert the commit. The column is additive and harmless if unused.
