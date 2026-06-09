# Batch 1 — Instant Plan Render + Progressive Coach Enrichment

## What this batch does

1. **Instant plan generation (triathlon).** `/api/finalize-plan` no longer blocks on
   GPT for triathlon plans. It builds every week from the deterministic scaffold
   (structure, durations, and zone targets are computed locally), saves the plan +
   sessions, and returns in ~1–2 seconds. The multi-minute loading wall is gone.
2. **Progressive enrichment.** A new `/api/enrich-week` endpoint upgrades one week's
   session `details` at a time via the LLM — concrete numeric targets (watts/pace/
   swim send-offs), the four-line Purpose/Workout/Intensity/Coach note format, and
   week-over-week progression references built from a summary of the previous week's
   key sessions. Invalid model output = scaffold details are kept (fail-safe).
3. **Client runner.** `lib/enrichmentRunner.ts` fires sequential enrich calls right
   after plan creation and keeps running across the redirect to /schedule. Progress
   is broadcast as `traingpt:week-enriched` / `traingpt:enrichment-complete` window
   events (optional UI hook for later).
4. **Model bump.** `coach-chat` and `generate-detailed-session` move off gpt-4-turbo
   to `process.env.OPENAI_CHAT_MODEL || 'gpt-4o'`.
5. **Honest hero copy** on the landing page (no more leading with "generated in
   seconds"; adaptive headline ships when the Sunday engine does).
6. **Bug fix:** finalize-plan now passes `planType` through to `startPlan`, so
   running plans actually use the sequential validated running pipeline (previously
   they silently defaulted to the triathlon path).

## Files

- `app/api/enrich-week/route.ts` (NEW)
- `lib/enrichmentRunner.ts` (NEW)
- `app/api/finalize-plan/route.ts` (modified — scaffold-first generation)
- `app/plan/page.tsx` (modified — kicks off enrichment after generation)
- `app/page.tsx` (modified — hero copy)
- `app/api/coach-chat/route.ts` (modified — model env var)
- `app/api/generate-detailed-session/route.ts` (modified — model env var)

All modified files were generated from your current source with anchored edits —
they are full drop-in replacements.

## Env (optional)

- `ENRICH_MODEL` — model for week enrichment (default: PLAN_MODEL, then gpt-4o)
- `OPENAI_CHAT_MODEL` — model for coach chat + detailed sessions (default: gpt-4o)

No schema changes. No new dependencies.

## Verify

```
yarn verify
```

Then smoke-test: generate a triathlon plan → it should render in ~2s → open
/schedule → session details should visibly upgrade over the next minute or two
(refresh to see enriched weeks; live updates can hook the window events later).

## Rollback

Each change is on its own branch/PR — revert the merge commit. The legacy LLM
path still exists untouched (`utils/start-plan.ts`, `utils/generate-week.ts`)
and is still used for running plans and as the triathlon fallback.
