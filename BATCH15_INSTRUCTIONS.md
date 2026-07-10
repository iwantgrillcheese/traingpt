# Batch 15 — Running Plans Time Out (Marathon/Half)

Bug: a user tried to generate a marathon plan and it timed out. Marathons are
NOT unsupported — they're in RACE_TYPES, the form sends planType:"running", and
the running utils (runTargets/buildRunningPrompt/validateRunWeek) all have
marathon-specific logic. The real cause is the running generation path itself.

Running weeks generate SEQUENTIALLY (each depends on the previous for
continuity), and each week could fire up to 5 correction rerolls — every reroll
a full LLM call. A 16–20 week marathon build is worst-case ~120 sequential
calls. Meanwhile start-plan capped the budget at 85s for ALL plan types, so
running blew the budget mid-generation, assertTimeBudget threw, and the request
failed. Triathlon dodges this via scaffold-first (no LLM in the request path);
running never got that treatment. Display/DB layers untouched — generation only.

## Changes
- utils/start-plan.ts: split the 85s budget into two ceilings. Triathlon keeps
  ~85s (parallel, fast). New RUNNING_PLAN_BUDGET_MS defaults to 260s so
  sequential running plans use most of the route's 285s window instead of dying
  at 85s. Ceiling picked by plan type; per-week deadlineMs now passed into
  generateWeek.
- utils/generate-week.ts: running rerolls capped at 2 (was hard-coded 5) via
  MAX_RUN_REROLLS. Reroll loop is now deadline-aware — within 15s of budget it
  stops and returns the best week seen rather than failing the whole plan
  ("plans must never fail visibly").

Heals automatically, no edits needed: triathlon path (still 85s + parallel,
unchanged behavior), finalize-plan route (already passes deadlineMs =
startedAt + 285s; running now actually uses it), the else-branch that calls
startPlan for running (already passed planType correctly — that was never the bug).

## Env (all optional)
- RUNNING_PLAN_TIME_BUDGET_MS — running ceiling (default 260000, capped 270000)
- RUNNING_MAX_REROLLS — rerolls per running week (default 2, capped 5)
- PLAN_GENERATION_TIME_BUDGET_MS — triathlon budget (unchanged)

## Tradeoff
2 rerolls vs 5 means an occasional running week lands slightly off its target
band, but the loop returns the best candidate seen, so it degrades gracefully.
A plan that generates beats one that times out. If running quality dips, set
RUNNING_MAX_REROLLS=3.

## Verify
yarn typecheck. Then generate a marathon plan ~16+ weeks out — it should
complete (can legitimately take 1–4 min now) instead of timing out. Confirm no
shorter gateway timeout sits in front of the Vercel function and the client
fetch doesn't abort early.

## Next (not in this batch)
Real fix is scaffold-first generation for running, mirroring triathlon: build
deterministically, return in ~2s, enrich per-week after. Removes the timeout
risk entirely and makes marathon plans feel instant.
