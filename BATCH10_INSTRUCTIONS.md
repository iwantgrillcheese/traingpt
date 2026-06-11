# Batch 10 — Plan vs Schedule Disambiguation

A user clicked "Plan" expecting their schedule and landed in the rebuild
wizard. Two fixes, web only (the Expo app already does this right — its tab
bar has no Plan tab; the wizard only appears via onboarding when no plan
exists):

1. **Nav says what the page is.** Desktop sidebar: "Plan" -> "Plan builder".
   Mobile-web bottom nav: "Plan" -> "Builder". Nobody hunting their week taps
   "Builder".

2. **Existing-plan guard on /plan.** When hasPlan is true, a banner renders
   under the header: "You already have an active plan... rebuilding here
   replaces your current plan and its adaptation history" with a
   "Go to my schedule" button. The misdirected user gets a one-tap exit; the
   intentional rebuilder scrolls past one honest sentence.

## Files (2)
- app/components/Layout.tsx (both nav arrays)
- app/plan/page.tsx (guard banner; built on the redesign version)

## Verify
yarn typecheck. Then on a phone-width window: bottom nav shows "Builder";
/plan with an existing plan shows the banner and the schedule button works.
