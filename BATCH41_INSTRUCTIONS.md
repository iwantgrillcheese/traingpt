# Batch 4.1 — Adaptation Engine Tuning (pre-Sunday hotfix)

Two coaching errors caught by simulation before the first live run:

1. **No more double-punishment.** An athlete at high compliance who missed
   only the long ride previously got the anchor capped AND a quality session
   downgraded. The downgrade rule now keys off compliance (<80%) alone — the
   cap rule already handles the missed anchor. One bad Saturday costs one
   progression, not the week's intensity.
2. **Empty-week copy.** "You completed 0 of 0 sessions — right on track"
   becomes "Last week had no scheduled sessions."

## Files
- utils/adaptNextWeek.ts (replaces Batch 4's version; pure-function change only)

## Verify
yarn verify, then re-run the production dry-run (see below) and confirm
scenario-2-type users (high compliance, one missed anchor) show only the
capped_duration change.

Certified scenarios (synthetic sim): perfect week untouched; missed-anchor
capped only; disaster week reset; mid-week single downgrade; race week
untouchable; deload cap-only; already-shorter anchor untouched; empty week
honest copy.
