# Batch 3 — Daily Session Email (the daily trigger)

## What this batch does

Adds the morning email that gives the product a "tomorrow": every day at
13:00 UTC (6am PT / 9am ET), athletes with `daily_email_opt_in = true` and a
non-rest, non-completed session today get one email where:

- The SUBJECT is the workout: "Today: Long Ride · 2h" (or "Today: Long Ride + Brick Run")
- The body carries the full prescription (Purpose / Workout / Intensity / Coach
  note lines pulled from session details) so they can train without opening the app
- The CTA deep-links to /schedule

Mirrors the existing upcoming-week cron exactly: same CRON_SECRET auth, same
service-role pattern, same Resend sender identity, same `?test=email` override,
plus `?date=YYYY-MM-DD` to dry-run any day.

## Files

- `app/api/send-email/daily-session/route.ts` (NEW — cron route)
- `lib/emails/DailySessionEmail.tsx` (NEW — template, same design language as UpcomingWeekEmail)
- `lib/emails/send-daily-session-email.ts` (NEW — Resend sender)
- `vercel.json` (modified from your current file — adds the daily cron entry)

## Depends on

Batch 2's SQL migration (`profiles.daily_email_opt_in`). Run that first.

## Env

Uses existing: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
Optional: `DAILY_EMAIL_TIMEZONE` (default `America/Los_Angeles`) — v1 uses one
reference timezone for "today"; per-user timezones are a follow-up.

## Verify

```
yarn verify
```

Then test against YOURSELF before any real send. Set your own profile row's
`daily_email_opt_in = true`, make sure you have a session today (or use a date
you do), and hit:

```
https://<preview-or-prod-domain>/api/send-email/daily-session?secret=CRON_SECRET&test=you@email.com
https://<preview-or-prod-domain>/api/send-email/daily-session?secret=CRON_SECRET&test=you@email.com&date=2026-06-11
```

The `test=` param restricts the run to that single email address. Check the
JSON response: `{ sent: 1, skipped: 0, errors: [] }` and the inbox.

## Notes

- Rest days and already-completed/skipped sessions never trigger an email.
- No session today = no email (silence is the correct behavior, not a streak guilt-trip).
- The Vercel cron only activates on production deploys; previews won't send on
  schedule, which is what we want.
