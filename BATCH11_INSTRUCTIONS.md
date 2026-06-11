# Batch 11 — Coaching Page Rebuild (the debrief, not the duplicate)

Diagnosis: "21/306 pts - 1/8 sessions" appeared FOUR times on one page; the
points philosophy was explained twice; Up next reprinted the schedule; the
"Coach Insight" was canned prose while the real Sunday adaptation summary
(plan_adaptations) was absent; and "View adapted week"/"Ask coach" were dead
<span>s, not controls.

## The new page, top to bottom
1. COACH UPDATE (real, full width) — fetches the latest plan_adaptations row
   (client-side, <=8 days old, same pattern as the schedule card). Shows the
   actual Sunday summary plus up to 4 changes with reasons. Falls back to the
   old consistency headline + one honest line when no review exists yet. One
   real control: "View this week's schedule" -> /schedule. The static "What
   moves readiness next" filler panel is gone; dead Ask coach span removed
   (returns when chat has a real entry point here).
2. TRAINING VALUE — unchanged, now the ONE home for points.
3. RACE READINESS — unchanged (incl. day-one gating).
4. STAT STRIP — Time trained + Sessions complete only. Points earned tile
   (duplicate of #2) and Plan to date tile (trivia) deleted. Grid 4 -> 2.
5. TRAINING MIX — unchanged, now full width (Weekly review block deleted —
   it was a paragraph-shaped restatement of the tiles).
6. LONGER TREND — unchanged.

Dead code pruned: upcomingSessions/missionText/weeklyReview consts and the
SessionDetailLines, EmptyCard, getSessionDateLabel, sessionPriority helpers
(orphaned by the Up next removal). 869 lines -> 629.

## Files (1)
- app/components/CoachingPointsDashboard.tsx
  (base = the currently deployed version; apply any time — independent of the
  session-modal patch)

## Verify
yarn typecheck. Then /coaching: each number appears exactly once; the dark
card shows the fallback copy until a real Sunday review exists for your user.
To light it up now: run adapt-week (no dry flag) for your uuid and refresh.
