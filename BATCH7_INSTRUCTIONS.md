# Batch 7 — Fitness Panel Fix (kill the fake score, keep the model)

## The bug
The old "Fitness score" was current CTL divided by your own max CTL of the
last 42 days — anyone with rising load (every new user) scores 100/100 by
construction. The model also cold-started at zero inside the visible window,
guaranteeing a rising curve.

## The fix (app/coaching/FitnessPanel.tsx — full replacement)
- 42-day lead-in: the CTL/ATL model now computes from windowDays + 42 days
  back and displays only the visible window, so curves start converged.
- The /100 score is gone. Replaced with two honest stats:
  - Sustained load: CTL expressed as weekly hours ("9.4 h/wk") — a number an
    athlete can sanity-check against their own life.
  - Form: Fresh / Steady / Loading from the fitness-fatigue balance, with a
    one-line caption.
- Headline now reflects actual trend (load now vs ~14 days ago): building /
  holding steady / easing off — and an honest "Building your baseline" state
  when there are <5 active days or no comparable history. No more "near your
  recent peak" verdicts from circular math.
- Daily load lookup is now a Map (was an O(days×activities) filter).
- Tooltip and y-axis labeled in h/day; copy updated; panel renamed
  "Training load" — which also dissolves the contradiction with Race
  Readiness, since the panel no longer claims to grade fitness out of 100.

## Verify
yarn verify, then /coaching: headline should describe your actual last month
(your 38h of Strava history should read "holding steady" or "building", not
a 100/100 verdict), sustained load should roughly match your real weekly hours.
