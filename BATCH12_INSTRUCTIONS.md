# Batch 12 — Transactional Emails + Fitness Chart v2

## SQL FIRST (Supabase SQL editor, before deploy)
    alter table public.profiles
      add column if not exists welcome_email_sent_at timestamptz;

## Part A — Emails

**Plan-ready email (wiring, not building).** Discovery: a complete welcome
pipeline (template, helper, /api/send-email/welcome route) existed in the
repo with ZERO callers. finalize-plan now fires it after sessions are saved
— "your {race} plan for {date}" to the user's auth email. The helper
swallows its own errors; it can never fail plan creation. Note: it sends on
every (re)generation — acceptable, it IS the plan-ready receipt.

**Signup welcome (new).** One-time "Your coach is ready — three moves to
start" email (Connect Strava / Build plan / Train), fired by the app shell
on first authenticated load. Idempotency is server-side and atomic: only
the request that flips profiles.welcome_email_sent_at from NULL claims the
send — tabs, reloads, and races cannot double-send. Existing users get it
once on their next visit (a feature, given Monday's re-engagement plans —
but be aware it's coming).

Files: lib/emails/SignupWelcomeEmail.tsx, lib/emails/send-signup-welcome-email.ts,
app/api/send-email/signup/route.ts (NEW); app/api/finalize-plan/route.ts,
app/components/Layout.tsx (EDITED — Layout includes your ReactNode sed fix).

## Part B — Fitness chart v2 (app/coaching/FitnessPanel.tsx)
The intervals.icu treatment, honestly scaled:
- Units are now MINUTES/DAY — whole numbers everywhere (the decimals are
  dead). Ticks, tooltips, all integer.
- Dual pane: fitness (blue filled area) + fatigue (purple line) on top;
  FORM below on its own axis with ZONE BANDS — yellow transition, blue
  fresh, grey neutral, green building, red high strain — drawn via a chart
  plugin. Tooltip names the zone: "Form: -12 (Building)".
- Form stat chip now reads from the same zones (Fresh / Steady / Building /
  High strain / Transition).
- Sustained load (h/wk) and the trend headline unchanged.
- "How this works" copy explains the bands in coach language.
v2 note: load is still duration-based; power/HR-weighted load (true
TSS-grade, matching intervals' numbers) is the planned upgrade.

## Verify
yarn typecheck. Then: (1) run the SQL; (2) deploy; (3) hard-reload the app
— your own welcome email should arrive once (and only once, on re-reload);
(4) generate a test plan — plan-ready email arrives; (5) /coaching — chart
shows two panes, integer values, colored form bands.

RESEND env already configured (daily emails prove it). From address:
TrainGPT <hello@traingpt.co> throughout.
