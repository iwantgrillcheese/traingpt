# Automated email preferences

Apply supabase/migrations/20261005215004_weekly_email_preference.sql before deploying the code. It adds profiles.weekly_email_opt_in boolean NOT NULL DEFAULT false; existing and new users are off. It leaves existing daily and marketing preferences unchanged. The existing daily column was introduced in BATCH2_INSTRUCTIONS.md; it must already exist.

Set EMAIL_UNSUBSCRIBE_SECRET to a cryptographically random secret of at least 32 bytes on the server (for example: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"). Never use a NEXT_PUBLIC_ variable. Keep the same secret across deploys: rotating it invalidates previously sent links. SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL are required by the public unsubscribe handler. Optional EMAIL_SITE_URL overrides https://traingpt.co for preview email links; use an HTTPS origin.

## Behavior and audit

- Daily workout emails: profiles.daily_email_opt_in must be exactly true.
- Weekly training briefs: profiles.weekly_email_opt_in must be exactly true. No migration backfill subscribes existing users.
- Product updates/tips: users.marketing_opt_in keeps its existing meaning. No recurring marketing sender was found in this repository.
- Both cron queries filter preferences server-side, and check again immediately before invoking the sender. Database check errors prevent sending. Existing test=email/date overrides and pause checks remain; test mode also respects opt-out.
- Settings persists all three independent toggles immediately, disables concurrent saves, verifies a returned row/value, and rolls back with an error message on failure (including denied/zero-row updates).
- Daily and weekly templates accept a required category-specific URL from the centralized server-only utility. Email settings remains a separate link.
- /unsubscribe needs no login. It verifies an HMAC-SHA256 signature over the user UUID, category, version and expiry; links last 365 days. Only the matching preference is set false. Repeated clicks are safe. Invalid/expired/missing-account links return 400; database/config failures return 503 and offer retry. The response has no scripts, no caching and no referrer leakage. Auth middleware is bypassed for this route.
- The only other Resend sender is the one-time authenticated signup welcome (app/api/send-email/signup). It remains unchanged. Authentication/password-reset are handled by Supabase and billing by Stripe; training opt-outs do not suppress those.

## Verification

npm run test:email: 5 passing tests covering token binding/tampering/expiry/configuration, category/user mutation, errors/idempotency, cron filtering in normal/test modes, opt-out during cron preparation and logged-out unsubscribe confirmation.

npm run typecheck: passed. Targeted Next lint: passed. Migration was executed and queried in PGlite (PostgreSQL-compatible local test runtime): passed. Re-run scripts/email-preference-migration.test.mjs with @electric-sql/pglite installed, or PGLITE_TEST_MODULE pointing at an installed module URL.

npm run build compiled and passed type validation, then failed prerendering /blog because NEXT_PUBLIC_SUPABASE_URL is absent. A complete build and live Supabase/RLS/email-provider verification still require the application environment. Production migration/deployment were not performed.

## Manual QA

1. In Settings turn daily off; confirm profiles.daily_email_opt_in=false, reload, run daily cron with test=email and a date containing a workout: no send.
2. Turn weekly off; confirm profiles.weekly_email_opt_in=false, reload, run weekly cron with test=email and upcoming sessions: no send.
3. Enable daily, receive a test email, open its unsubscribe URL in a logged-out browser: daily becomes false, weekly/marketing unchanged; confirmation appears. Repeat the click.
4. Enable weekly, receive a test email, open its unsubscribe URL logged out: weekly becomes false, daily/marketing unchanged.
5. Change the token user/category/signature, or remove it: error page and no preference changes.
6. Re-enable each category in Settings, reload and verify the DB and a subsequent test send.
7. Block/fail a Settings update (including zero-row RLS result): checkbox rolls back and displays an error; retry succeeds.
8. Verify weekly is initially off on both existing and newly created profiles, and the separate Email settings link opens Settings.

## Limits

Already accepted provider deliveries cannot be recalled. The final preference read narrows the race window; a read and the external provider call are not one atomic transaction. Email security scanners that follow GET links may unsubscribe, consistent with the requested single-click behavior. Old generic links already delivered contain no identity/category and cannot be retroactively made actionable; they show guidance to Settings. Tokens contain a signed UUID, not an email address; they are bearer links and should not be logged/shared. Live RLS behavior and actual inbox delivery remain manual QA.
