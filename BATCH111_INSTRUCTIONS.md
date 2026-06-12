# Batch 11.1 — Coach Update Fallback: Computed, Not Canned

The empty state ("The next win is consistency") was a fortune cookie. Now,
when no Sunday review exists yet, the card computes from the live week:

- HEADLINE: the highest-value remaining session this week (picked by the
  points formula — longer/key/race-specific weigh more), e.g.
  "Saturday's Long Ride is the week's anchor." Falls through to
  "Week banked. Review incoming." (work done, nothing left) or
  "Nothing left on the board this week." (empty week).
- BODY: "Bank what you can — your coach review lands Sunday, Jun 14 and
  rewrites next week from what actually happened." (date computed from the
  actual week end.)

Once a real plan_adaptations row exists (<=8 days), the card shows the actual
review as before — this only replaces the waiting state.

## Files (1)
- app/components/CoachingPointsDashboard.tsx (replaces Batch 11's copy)

## Verify
yarn typecheck; /coaching before Sunday should name your real anchor session
and the real review date.
