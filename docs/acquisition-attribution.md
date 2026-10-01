# Acquisition attribution investigation and rollout

TrainGPT/Brick retains its existing screens, plan engine, authentication provider and design. This change adds attribution persistence and an optional question within the existing plan-ready review.

## Proven implementation failures

Baseline: `d6c149adbe194238a5b75ef6036063b47595b8fb`.

- Tracking starts before login: `app/layout.tsx` mounts `FunnelTelemetry` globally, and `app/components/FunnelTelemetry.tsx` initializes PostHog, captures page visits and captures `landing_viewed` on `/`. However, general anonymous page/landing telemetry was only wired into the layout on September 8 in `cb99487`; it was absent earlier.
- `app/components/PostHogIdentityBridge.tsx` originally calls `reset()` whenever `user` is null. `lib/auth/AuthProvider.tsx` initially has `user=null, loading=true`. Every full page load, including the return from OAuth, therefore resets the saved anonymous distinct ID before the account is loaded. This can orphan the original anonymous landing history and start the next identity on `/plan` or `/schedule`, with Google as the referrer. The original bridge also delays `identify()` behind profile/plan queries.
- `lib/analytics/posthog-client.ts` already guards initialization with a module flag, uses `localStorage+cookie`, and calls the supported `posthog.identify(user.id)`. Repeated calls to `initPostHog()` within one page are not the demonstrated failure. There is no evidence that OAuth intrinsically prevents linking; the premature reset is the concrete defect.
- Original signup detection compares `last_sign_in_at` to `created_at` within two minutes and stores its dedup flag only in a React ref. A session restored days later can retain its first sign-in timestamp and repeatedly satisfy that condition. Live Supabase data confirms Senne's timestamps are still only 11.31 seconds apart and Matthew's 0.59 seconds apart. Those accounts emitted nine signup events over five and three UTC days respectively in September.
- `app/login/page.tsx` uses Google OAuth and the current origin for its callback. `app/auth/callback/route.ts` exchanges the PKCE code and redirects; it does not itself emit signup. The heuristic bridge creates the repeated signup events. The current web login has no email signup flow. Supabase's email provider being enabled does not mean the product exposes email signup.
- Both production hosts currently return HTTP 200 without a redirect, confirmed by non-executing HEAD requests. Repository middleware only refreshed Supabase sessions; no canonical-host redirect existed. PostHog's supported cookie persistence can share an anonymous ID across sibling hosts, so hostname traffic alone does not prove an identity split. Origin-local persistence and multiple host entry points increase inconsistency; redirects did not explain away the explicit reset defect.
- Preview URLs initialize the same analytics helper without environment labels. The live project's only test filter excludes localhost/127.0.0.1; it does not exclude Vercel previews or the founder. There is no separate app consent UI/gate. SDK opt-out behavior exists and is retained; marketing and daily-email opt-ins are separate preferences.

## Live affected-account evidence

Window: September 1 through October 1, 2026, UTC; query upper bound October 2.

| Account | Initial domain | Initial path | Signup events / distinct UTC days | Linked landing events across all person IDs |
|---|---|---|---|---|
| Senne Van Lent | accounts.google.com | /schedule | 9 / 5 | 0 |
| Josh Crisolo | accounts.google.com | /plan | 1 / 1 | 3 |
| Andy Cumino | accounts.google.com | /schedule | 0 / 0 | 0 |
| Matthew Nguyen | accounts.google.com | /plan | 9 / 3 | 1 |

The last column counts all events linked to the PostHog person, not just the authenticated distinct ID. Josh and Matthew demonstrate that some anonymous linking succeeds. These results do not establish their true historical acquisition source. No historical sources are changed or inferred.

## September 8

PostHog project 332677 is configured for UTC, with person-on-events enabled.

| UTC date | Unique PostHog people | Unique distinct IDs | Events |
|---|---:|---:|---:|
| September 7 | 6 | 6 | 22 |
| September 8 | 29 | 31 | 148 |
| September 9 | 9 | 13 | 54 |

All people in this three-day sample appeared on production hostnames; previews are not an observed explanation for this particular spike. September 8 contains four identified accounts, all already existing. The confirmed founder account generated 76 events (including nine identify events); 25 people had no identify event that day. Many anonymous people have only one or two vitals/pageleave events around login and navigation. Sixteen people appear during the 20:00 UTC hour, before general landing telemetry was deployed.

Repository history shows landing telemetry wired at September 8 14:59:47 Los Angeles / 21:59:47 UTC. Vercel confirms the production rebrand/audit deployment for `b087005` was created at approximately 22:38:55 UTC, following numerous audit previews. The first observed `page_viewed`/landing telemetry that day is in the 22:00 UTC hour. This changes what visitors are observed, but cannot by itself explain the earlier peak.

Supabase shows one actual new account on September 8 in Los Angeles: created September 9 01:40:53.488972 UTC / September 8 18:40:53 PDT. There were zero actual new accounts on September 8 UTC in this adjacent-day sample.

Conclusion: 29 tracked identities is not 29 newly acquired athletes. Founder activity, repeated identity resets, restored sessions and a changed instrumentation surface undermine that interpretation. We cannot reliably allocate the short anonymous identities between real visitors, founder/testing fragments and automation. No bot conclusion is proven, and no exact historical acquisition channel can be reconstructed.

Deployment reference: https://vercel.com/camerons-projects-73f67765/traingpt/W2MZr5wpC8VWEapUJTyyzMP68fBr

## Changes

- `lib/analytics/attribution.ts`: captures the first eligible public entry URL/path, UTC timestamp, external referrer origin/domain and five UTM fields. Auth/API/login/private-product pages cannot establish a first touch. Only UTM query fields survive URL sanitization; fragments, credentials, OAuth codes and arbitrary parameters do not. Referrer paths are discarded. Provider and own-domain sources become `unknown/direct`. Google search remains a valid external referrer; Google login does not.
- Versioned storage uses a 90-day first-party cookie shared across `traingpt.co` and its www hostname, plus localStorage fallback. OAuth does not carry attribution in callback query parameters. The anonymous browser's first touch does not change when later campaign links are visited.
- `PostHogIdentityBridge`: identifies as soon as auth loading completes, retains the pre-auth anonymous identity, and resets only on actual `SIGNED_OUT` or account switching. The existing SDK opt-out gates measured attribution and analytics events. Basic account/environment provenance is still recorded with no touch when analytics is off, so consent-off production accounts remain unknown in the denominator.
- `posthog-client.ts`: explicitly enables shared subdomain cookies, labels every outgoing event `environment=production|test`, sanitizes URL properties, suppresses provider/internal referring domains, and adds separate `acquisition_source`/`acquisition_first_touch` person properties. Legacy `$initial_*` person properties are not rewritten. Measured source becomes the saved account source after association, including unknown for historical accounts.
- `middleware.ts`: new anonymous www entry requests receive a 308 to the apex with campaign parameters preserved. Existing www Supabase session cookies and in-flight PKCE callbacks remain on their original host; redirecting those sessions would discard their host-scoped auth state.
- `app/api/acquisition/route.ts` and `acquisition-server.ts`: authenticated server routes scope all writes to `requireUser()`, use the existing service-role architecture, validate/sanitize browser attribution again, and insert first touch without overwriting conflicts. Only accounts created after the migration's rollout timestamp can receive new measured attribution; historical accounts remain unknown.
- Signup uses an atomic persisted claim per actual account, instead of session timestamps/React refs. Returning sessions cannot claim it again. Preview accounts never emit the production signup event.
- `finalize-plan`: after the existing quality gate and successful atomic plan/session save, records a production saved-plan fact with positive session count. Optional reporting failures cannot undo the save. First-plan eligibility is set only if the athlete had no previous saved plan; uncertain lookups suppress the question conservatively.
- `DiscoveryQuestion`: optional, dismissible section inside the existing plan-ready review. The seven requested options and a 200-character optional detail are saved to profiles. Analytics gets one `discovery_reported` category event, never the detail. Saving/skipping does not gate schedule navigation; replacements do not reopen the question.
- `docs/acquisition-report.sql`: administrator-only queries for actual created accounts, validated saved-plan users, repeat schedule users, self-reported categories, unknown percentage and environment coverage. Two verified founder accounts are excluded. Additional known test account IDs belong in `acquisition_exclusions`.

## Reporting definitions

The default SQL cohort is October 2026 in `America/Los_Angeles`; adjust both explicit month bounds together. Timestamps are stored in UTC. Schedule usage days are Los Angeles dates, with one row per account/day. Repeat usage means schedule visits on at least two different dates before the report end. Saved-plan conversion means a successful validated persisted plan/session operation before report end, not a preview generation or a raw analytics event.

One row/unique account is the counting unit. The denominator uses `auth.users.created_at` and known production provenance; deleted, anonymous-auth, preview/test-origin and explicitly excluded founder/test accounts are removed. Accounts with no verified deployment provenance are reported in a separate coverage query, rather than guessed to be production. Environment means the first authenticated association environment, not an inferred source from an OAuth provider.

Sources are `utm:<lowercase utm_source>`, otherwise `referrer:<external hostname>`, otherwise `unknown/direct`. UTM medium/campaign/content/term remain separate metadata. Direct, hidden referrer, blocked storage, consent-off and genuinely missing measurement are combined as unknown/direct; absence of evidence does not distinguish them. Self-report does not change measured source. The SQL is prospective for plan and schedule ledgers; it does not manufacture historical conversion data. Existing marketing dashboards should filter new events to `environment=production` and exclude the known founder/test account IDs; historical events require explicit production `$host` filters and remain subject to identity defects.

## Verification

- `yarn verify`: passed lint (existing warnings), typecheck, all existing calendar/Strava/plan/athlete-context/duration/feedback suites, 14/14 plan-quality cases and production build. The final full verification run passed all 103 automated tests, including 12 acquisition tests.
- Attribution tests cover five UTM fields, secret stripping, provider/self-referrer exclusion, callback/private-page exclusion, direct/search source, timestamp and preview rejection, simulated Google return with the same anonymous identity, returning campaign stability, cross-host cookie reuse, consent-off behavior, immutable server association, persisted signup claims, saved-plan eligibility, actual callback redirects/code exchange, actual www middleware, and discovery save/skip/origin validation.
- Local Postgres (PGlite) applied the actual migration and executed the actual report SQL against fixtures. Verified source conflicts do not overwrite, second signup/discovery claims return no rows, schedule days deduplicate, report conversions/counts/unknown percentage match fixtures, RLS is enabled, and authenticated clients cannot access the server-only acquisition tables. No production DDL or historical data changes were made.
- Offline Chromium rendered the actual discovery React component with the repository stylesheet. Saved Reddit plus detail produced one category event and hid the question; skip produced no event and schedule navigation remained usable. A failed save displayed a retry message without blocking schedule navigation. This uses mocked API responses and is a component verification, not a full deployed-app walkthrough. `outputs/discovery-question.png` captures the rendered section.
- Live PostHog/Supabase/Vercel investigation was read-only. Live HEAD requests confirmed both hostnames currently return 200.

## Migration and release checklist

1. Review/apply `supabase/migrations/20261001165352_acquisition_attribution.sql` through the existing Supabase migration workflow. It adds server-only ledgers and optional profile fields, with no source backfill. Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured on Vercel; it already serves other existing server routes. The migration records the measurement rollout cutoff.
2. Review the draft PR, run GitHub checks and validate the preview's visual behavior; preview events are labeled test and its acquisition is excluded from production. No automatic merge or production deployment is performed, following AGENTS.md.
3. On an approved production release, use a dedicated excluded Google test account and a fresh browser: visit `https://www.traingpt.co/?utm_source=reddit&utm_medium=social&utm_campaign=attribution-check`, complete Google signup, inspect the account first-touch row and PostHog person history, and confirm one signup event. Initial www request should 308 with tags intact; both landing and account events should share the PostHog person.
4. Log out and log back in through a different tagged campaign. Confirm account first touch/source remain Reddit and no new signup event is emitted. Verify an existing signed-in www session still works.
5. Create the first real plan, optionally save a discovery answer, reload and verify no second response event. Repeat with Skip and with a failed discovery request; the schedule must remain usable.
6. Verify analytics opt-out: no measured touch or analytics event; account remains unknown. Verify a Vercel preview account is test-origin and excluded from report SQL. Add any other known test IDs to the exclusion table.
7. Email signup is not exposed by this web product, so no email flow is claimed as verified. If one is introduced later, route it through the same account association path and add an integration case.

## Limitations

Full interactive Google consent/new-account verification and the full local browser-to-live-Supabase walkthrough are not completed. Automatic approval review rejected starting the local application server with the reason `blocked by policy`. Component browser checks and code/API/SQL tests are completed instead. The migration remains unapplied to production.

Signup/discovery analytics use an at-most-once persistent claim. Browser closure, an ad blocker, consent revocation or a lost HTTP response between claiming and capturing may lose an analytics event; this implementation does not claim exactly-once network delivery. Account creation and saved self-report in Supabase are authoritative for reporting. Plan/schedule ledger writes are deliberately nonfatal and can undercount during outages; reports are not historical backfills. Attribution lost to browser privacy, cleared storage, different-device signup, prior resets or pre-rollout gaps cannot be reconstructed. The first stored association remains stable even if it is unknown. No reliable historical channel was assigned to the named accounts.

PostHog references: [identity linking](https://posthog.com/docs/product-analytics/identify), [supported persistence](https://posthog.com/docs/libraries/js/persistence), [configuration and before_send](https://posthog.com/docs/libraries/js/config). Supabase: [user/profile ownership](https://supabase.com/docs/guides/auth/managing-user-data).

## Baseline code references

- [Premature reset during null session](https://github.com/iwantgrillcheese/traingpt/blob/d6c149adbe194238a5b75ef6036063b47595b8fb/app/components/PostHogIdentityBridge.tsx#L23)
- [Initial auth loading state](https://github.com/iwantgrillcheese/traingpt/blob/d6c149adbe194238a5b75ef6036063b47595b8fb/lib/auth/AuthProvider.tsx#L44)
- [Timestamp-based signup heuristic](https://github.com/iwantgrillcheese/traingpt/blob/d6c149adbe194238a5b75ef6036063b47595b8fb/app/components/PostHogIdentityBridge.tsx#L61)
- [Anonymous landing tracking](https://github.com/iwantgrillcheese/traingpt/blob/d6c149adbe194238a5b75ef6036063b47595b8fb/app/components/FunnelTelemetry.tsx#L21)
- [Original analytics persistence/initialization](https://github.com/iwantgrillcheese/traingpt/blob/d6c149adbe194238a5b75ef6036063b47595b8fb/lib/analytics/posthog-client.ts#L10)
- [Google OAuth callback](https://github.com/iwantgrillcheese/traingpt/blob/d6c149adbe194238a5b75ef6036063b47595b8fb/app/auth/callback/route.ts#L12)

