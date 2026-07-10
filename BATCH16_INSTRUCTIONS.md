# Batch 16 — One Signup Email, Not Two

Bug: a brand-new user who signed up and immediately built a plan got two
near-identical welcome emails seconds apart:
1. "Your coach is ready" — SignupWelcomeEmail, fired by app/components/Layout.tsx
   -> /api/send-email/signup on first authenticated load (idempotent via
   profiles.welcome_email_sent_at).
2. "Your training plan is ready" — WelcomeEmail, fired inside finalize-plan on
   every plan generation.

Decision: keep the signup email as the single welcome. Drop the plan-ready send.

## Changes
- app/api/finalize-plan/route.ts: removed the sendWelcomeEmail block after
  sessions are saved, and its now-unused import. No email fires on plan
  creation now. The signup email in Layout.tsx is untouched and remains the one
  welcome. (Note it sent on EVERY regeneration before, not just the first plan —
  so this also stops repeat "plan ready" emails on re-generates.)

Heals automatically, no edits needed: the "coach is ready" signup path
(Layout.tsx + /api/send-email/signup) still works exactly as before; weekly
upcoming-week email (/api/send-email/upcoming-week) is a separate cron and was
never part of the signup dupe — left alone.

## Not touched (optional future cleanup)
Two dead artifacts remain from Batch 12, now fully unused — safe to delete
later if you want, but harmless:
- app/api/send-welcome-email/route.ts (standalone WelcomeEmail route, zero callers)
- lib/emails/WelcomeEmail.tsx, lib/emails/send-welcome-email.ts (the plan-ready
  template + helper, now uncalled)
Left them in this batch to keep the diff to one file and avoid surprises.

## Verify
yarn typecheck. Then: sign up a fresh test user and build a plan — you should
get exactly ONE email ("Your coach is ready"), not two. Regenerate the plan —
no additional email should arrive.
