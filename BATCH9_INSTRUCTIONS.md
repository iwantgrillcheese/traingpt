# Batch 9 — Redesign Review Fixes (rigor pass on the new design)

Built ON TOP of the brand-ui-polish patch — these files were generated from a
reconstruction of current main (original + all batches + the redesign patch,
applied with zero conflicts). Drop-in replacements.

## The four findings, fixed

1. **Broken 'use client' directive (build/runtime landmine).**
   CoachingPointsDashboard had `("use client")` AFTER an import — that is a
   no-op expression, not a directive. The file silently became a server
   component. It happens to survive today (no hooks), but the first useState
   anyone adds breaks the page in production. Directive restored to line 1.

2. **The fabricated readiness number is gone.**
   The schedule rail's "Race readiness 52" was literally invented:
   `52 + adherence × 0.36`, floored at 28 — a cosmetic formula unrelated to
   the Coach page's real computation (hence 52 vs 15 on adjacent screens).
   The rail ring now shows THIS WEEK'S ADHERENCE — a real number the athlete
   can verify against the calendar under it — labeled "This week", with
   honest states ("No sessions scheduled" / "Building the week" / "On plan").
   Race readiness now exists in exactly one place: the Coach page, computed.

3. **One home per number, restored in the new layouts.**
   Topbar counters (planned / complete) removed — phase + week label remain;
   the rail owns the numbers. The rail's separate Adherence stat box removed
   (the ring IS adherence now). Complete + Volume stay.

4. **Day-one readiness gating (Coach page).**
   With zero completed work and zero points, the ring shows "—" and
   "Building your baseline" with honest copy, instead of grading a brand-new
   athlete 15/100. The lime ring earns its number.

Plus: the hero headline now makes the claim only this product can make —
"Training that adapts to the week you had." (visual treatment unchanged).

## Files (3)
- app/components/CoachingPointsDashboard.tsx
- app/schedule/CalendarShell.tsx
- app/page.tsx

## Verify
yarn verify, then: /schedule rail says "This week" with adherence in the ring
and no duplicate counters in the topbar; /coaching shows "Building your
baseline" on a fresh account and a real number once work exists; landing
headline reads the adaptive claim.
