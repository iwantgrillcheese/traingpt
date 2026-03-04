# PostHog Product Analytics v1

## Environment Variables

Set in Vercel / local env:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST` (default: `https://app.posthog.com`)

## Distinct ID + Identity

`distinct_id` is set to Supabase `user.id` via `identify()`.

User properties synced on sign-in/session load:
- `email`
- `created_at`
- `has_strava`
- `has_plan`

On logout: `posthog.reset()`.

## Tracked Events (v1)

Auth:
- `user_signed_up`
- `user_logged_in`

Plan generation:
- `plan_generation_started` (`race_type`, `race_date`, `experience`, `max_hours`, `rest_day`)
- `plan_generation_completed` (+ `generation_time_ms`)
- `plan_generation_failed` (`error_type`, `generation_time_ms`)

Schedule:
- `schedule_viewed` (`view`: `mobile` | `month` | `desktop`)

Session interaction:
- `session_opened` (`sport`, `date`, `is_planned`)

Strava:
- `strava_connect_clicked`
- `strava_oauth_success`
- `strava_sync_completed` (`activities_imported`)

## Privacy

No raw chat text, workout text, or workout notes are sent. Only metadata events/properties.

## Recommended PostHog Dashboard Setup

### Core Health
- DAU / WAU / MAU (active event filter = any of: `schedule_viewed`, `plan_generation_completed`, `session_opened`, `strava_sync_completed`)
- New users per day
- Stickiness (DAU/MAU)

### Activation Funnel
`user_signed_up` → `plan_generation_completed` → `schedule_viewed` (24h) → `session_opened` (3d)

### Retention
Retention based on active events above (D1/D7/D30)

### Plan Generation Reliability
- `plan_generation_completed / plan_generation_started`
- P95 of `generation_time_ms`
- Failures grouped by `error_type`

### Strava Conversion
`strava_connect_clicked` → `strava_oauth_success`
