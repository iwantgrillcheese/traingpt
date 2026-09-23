# Brick — endurance repositioning and domain migration

Status: landing-page changes prepared on `brick/endurance-landing`. Domain migration is deferred. Preferred domain: `trainwithbrick.co`; purchase, ownership, DNS, and account configuration are not verified. Do not treat this document as a completed migration.

## Landing-page release

- Preserve Brick's ink, warm white, rounded cards, typography, and lime accent.
- Hero: “Train for what’s next.” Personalized training for runners and triathletes, with plan creation, Strava, and adaptation immediately explained.
- Equal running and triathlon cards. Explicit distances: 5K, 10K, half marathon, marathon, sprint triathlon, Olympic triathlon, 70.3, full-distance triathlon.
- Main CTA uses the existing `/plan` builder via `/login?next=%2Fplan` for visitors. The existing `/preview` and specialist triathlon pages remain available; their triathlon-only preview is not presented as a running preview.
- Reuse `public/landing/mobile-workout.png`, `public/landing/dashboard.png`, and the supplied Strava compatibility logo. The dashboard is an existing asset, not a newly captured view. Refresh it from a clean demo account if the current product differs before final publishing. Do not use `mobile-week.png`: it contains garbled text.
- Root metadata and shared footer describe running and triathlon. Authenticated screens, plan generation, Strava behavior, database, email delivery, and domain settings are unchanged.

## Observed dependencies (source audit, September 23, 2026)

| Area | Current source / configuration | Required migration check |
| --- | --- | --- |
| Hosting | Vercel project `traingpt`, `prj_RTL0v9bnp1WSVkYSge1J2nDBTsBl`, team `team_scwUZYAFnIiGshP8D88KsPWP` | Add the purchased domain to this same project; retain `traingpt.co` and `www.traingpt.co`; verify DNS and TLS before routing traffic. |
| Supabase Auth | `app/login/page.tsx` builds an origin-based `/auth/callback`; `app/auth/callback/route.ts` exchanges the code | Keep the same Supabase project and user IDs. Configure Site URL and exact allowed callback/redirect URLs for the new origin; retain old URLs during transition. Check every enabled login/recovery method and provider settings. |
| Browser sessions | Supabase cookies/storage are origin scoped | Existing sessions do not automatically move between unrelated domains. Expect one sign-in on the new domain; verify the same account, plan, and history appear. Never copy session tokens through URLs. |
| Strava OAuth | `app/plan/page.tsx`, `app/api/strava/callback/route.ts`, `app/api/strava/mobile-connect/route.ts` | Confirm callback-domain restrictions in the existing Strava app. Verify new connect and reconnect on the new host before cutover. Keep the client ID and stored tokens; do not create a replacement Strava app. |
| Public origin variables | `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | Inventory Vercel production and preview values, plus other discovered origin variables; update intended scope and rebuild. Supabase URLs/keys stay attached to the existing project. Do not log secrets. |
| Email | `lib/emails/{SignupWelcomeEmail,DailySessionEmail,UpcomingWeekEmail}.tsx` contain old-host URLs; `send-*-email.ts` contain TrainGPT sender names | Update sender display name and links at migration. Keep the working sender address until the new mail domain is verified. Check Resend, SPF/DKIM/DMARC and replies if switching addresses. Verify destination routes including unsubscribe rather than assuming they work. |
| SEO | `app/layout.tsx`, `next-sitemap.config.js`, `public/sitemap.xml`, `public/robots.txt` | Set production canonicals, Open Graph URLs, sitemap and robots to the new origin only when ready; preserve route paths and page-specific metadata. Search all tracked files for old URLs. |
| Billing / integrations | `app/api/stripe/portal/route.ts` uses `NEXT_PUBLIC_BASE_URL`; other callbacks may live in dashboards | Check checkout return URLs, portal returns, webhook endpoints and any configured Strava subscriptions, even if no paying users. Keep working endpoints during transition. |
| Mobile links | `app/auth/mobile-callback/route.ts` uses `traingpt://auth/callback` | Preserve the existing native scheme; changing it requires a separate mobile release. Check app links to the old host. |
| Scheduled jobs | `vercel.json` includes adaptation and email jobs | Keep the same Vercel project and job configuration. Verify jobs still run once, and generated email links use the intended host. |

## Ordered cutover gates

1. Founder purchases the chosen domain after returning. Confirm spelling, ownership, renewals, DNS access, and the desired www behavior. No purchase is performed by this change.
2. Record the known-good production deployment and current origin configuration securely. Keep the old domain renewed and attached. Confirm data backup/recovery practices for the existing Supabase project; no data migration is required.
3. Add the new domain to the existing Vercel project and verify DNS/TLS. Restrict indexing of any temporary duplicate deployment until canonical configuration is ready.
4. Configure Supabase and OAuth dependencies, then test callback round trips on the actual new host. Some providers restrict simultaneous callback domains: coordinate the switch, avoid redirecting in-progress OAuth codes across origins, and test old-link recovery. Do not enable blanket redirects yet.
5. Prepare one migration change for origin environment variables, email links/display names, metadata, sitemap and robots. Verify any new email sender before using it.
6. On the new host, test with a controlled existing account: login/logout, recovery where supported, same user ID, existing plans/history, schedule/session detail, completion tracking, calendar export, Strava connection and activity sync, and weekly adaptation records. Test a running and triathlon plan in a controlled account as a regression check, without changing generation behavior. Verify transactional links and billing return routes where enabled.
7. Only after those checks, make the new host canonical and add permanent 301/308 redirects for old public GET pages, preserving paths and query strings. Explicitly handle/exclude OAuth callbacks, APIs, webhooks, verification files, and native links until their integrations have been verified. Do not indiscriminately redirect POST requests or OAuth codes.
8. Regenerate sitemap, submit the new property and migration information to search tools where applicable, verify representative deep links, and monitor auth errors, Strava failures, failed plan generation, broken links and traffic over the following week.

## Rollback

If account access, callbacks, synchronization or key workflows fail, disable new old-host redirects, restore the recorded origin values/provider settings and redeploy the known-good version on the old host. Retain both domains and the same database/project throughout. Re-test login and sync before retrying. A landing-page copy rollback must not require touching data or OAuth configuration.

## Release acceptance

- At 320, 390, 768 and 1440px: clear running + triathlon positioning, no horizontal overflow, readable type, usable tap targets and visible keyboard focus.
- Hero CTA reaches the existing builder through login; login CTA returns to the schedule; authenticated users retain direct app access.
- All eight supported distances appear in visible page content, with equal category prominence.
- No unsupported sport, live metric, invented testimonial, generated product screenshot, or claim of instantaneous adaptation.
- Production domain migration remains blocked until the gates above have evidence recorded.

## Verification recorded for this draft

- Targeted ESLint: no errors in the changed TSX files; one existing font-placement warning in `app/layout.tsx`.
- Git whitespace/diff check: passed.
- Source audit: all advertised distances exist in `app/plan/page.tsx`; adaptation cron exists in `vercel.json`; CTA uses existing login `next` handling.
- Full typecheck: blocked by errors outside the changed files (schedule activity typing, Supabase cookie callback typing, Stripe API version). Initial install resolved package ranges; a frozen-lockfile install did not complete, so this is not a definitive production-build result. No dependency files were changed.
- Browser/device verification: incomplete. Local browser startup failed; cloud browser denied localhost access. Do not mark responsive or end-to-end checks as passed.
- Remote publication: founder explicitly authorized pushing the branch to `iwantgrillcheese/traingpt` and opening a draft PR. Production release and domain cutover remain deferred.
