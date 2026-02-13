# Sprint 1 — Race Hub design + IA changes

## Sprint theme
**Race Anchor + IA cohesion**

## Sprint goal
Make race context the central object of the product and align app structure/flows around it.

---

## 1) Where race context exists today (inventory)

## A. Plan + onboarding
- `app/plan/page.tsx`
  - Captures `raceType` + `raceDate` and uses them as core generation inputs.
  - Supports race prefill from `/races` query params.
  - Reads latest plan (`race_type`, `race_date`) for form prefill and walkthrough context.
- `app/login/page.tsx`
  - Sends user into plan flow; no explicit race object visibility post-auth.
- `app/races/page.tsx`
  - Race finder feeds selected race to `/plan?raceType=...&raceDate=...`.

## B. Plan generation system
- `app/api/finalize-plan/route.ts`
  - Persists `race_type`, `race_date` in `plans`.
  - Computes phased plan structure (Base/Build/Peak/Taper).
  - Uses race date to compute total weeks and inserts race-day marker.
- `types/plan.ts`, `utils/buildCoachPrompt.ts`, `utils/buildRunningPrompt.ts`
  - Race context appears in generation prompts/typing.

## C. Schedule
- `app/schedule/page.tsx`
  - Reads latest plan race data for walkthrough context (`race_type`, `race_date`).
  - Race context is present in data fetching but not promoted as persistent UI anchor.
- `app/schedule/CalendarShell.tsx`
  - Walkthrough affordance exists, but no Race Hub strip.

## D. Coaching/dashboard
- `app/coaching/CoachingClient.tsx` + `app/components/CoachingDashboard.tsx`
  - Focused on adherence/performance metrics; race context not first-class in UI.
- `app/api/coach-chat/route.ts`
  - Reads `raceType`, `raceDate` and includes in coaching context.

## E. Navigation / IA
- `app/components/Layout.tsx`
  - Current nav: Plan Generator / My Schedule / Coaching / Settings.
  - No explicit race object in top-level IA.

---

## 2) Race Hub concept (v1 design)

## Purpose
A persistent, reusable module that makes race status visible and actionable across core pages.

## Core fields (required in v1)
- **Race type**
- **Race date**
- **Countdown** (days to race)
- **Current phase** (Base/Build/Peak/Taper; derived from plan timeline)
- **Readiness/progress** (placeholder allowed in Sprint 1)

## Race Hub v1 component shape
**Component:** `RaceHubCard` (shared)

**Data contract (v1):**
```ts
type RaceHubModel = {
  planId: string;
  raceType: string;
  raceDate: string; // YYYY-MM-DD
  daysToRace: number;
  currentPhase: 'Base' | 'Build' | 'Peak' | 'Taper' | 'Unknown';
  readinessLabel: 'On track' | 'Building' | 'Needs attention' | 'Unknown'; // placeholder-backed
  progressPct?: number; // optional placeholder bar
};
```

## Placement (Sprint 1)
- Top of `/schedule`
- Top of `/coaching`
- Context block on `/plan` (especially after plan exists)

## Empty states
- No active plan/race:
  - “No race selected yet”
  - CTA: **Set race goal** → `/plan` or `/races`

## UX behavior
- Clicking Race Hub opens `/races` (edit target race) or Race details section.
- Countdown and phase must be identical across pages.

---

## 3) IA/navigation changes (proposal)

## Current IA issues
- “Plan Generator” dominates nav language, under-representing race-prep operating flow.
- Race object is hidden in generation and backend context, not visible as global anchor.

## Proposed IA (Sprint 1 scope)
1. Rename nav labels for journey clarity:
   - `Plan Generator` → **Plan**
   - `My Schedule` → **Today** (or keep Schedule if we want conservative rollout)
   - `Coaching` → **Insights**
2. Introduce **Race** as top-level destination (points to `/races` initially).
3. Keep Settings unchanged.

### Proposed order
- Today / Schedule
- Plan
- Insights
- Race
- Settings

## Flow alignment updates
- Login success route stays `/plan` for now, but once a plan exists, primary CTA should push users toward Schedule with visible Race Hub.
- From plan completion, maintain schedule redirect, but show Race Hub as first visual anchor on arrival.

---

## 4) Sprint 1 execution plan (docs-first, no large code)

## Deliverables this sprint
1. Race context inventory (this doc section).
2. Race Hub v1 product spec and data contract.
3. IA/nav change proposal and migration plan.
4. Implementation checklist for subsequent build PRs.

## Likely files/systems impacted in build phase (next PRs)
- `app/components/Layout.tsx` (nav changes)
- New: `app/components/RaceHubCard.tsx`
- `app/schedule/page.tsx` (Race Hub placement)
- `app/coaching/CoachingClient.tsx` or `app/components/CoachingDashboard.tsx`
- `app/plan/page.tsx` (Race Hub contextual view)
- Shared Race Hub selector utility (new, e.g., `utils/raceHub.ts`)

## Acceptance criteria for Sprint 1 docs/design
- Race context inventory is complete across onboarding/plan/schedule/coaching/race finder.
- Race Hub v1 includes required fields: race date/type/countdown/phase/readiness placeholder.
- IA proposal defines explicit nav labels/order and rationale.
- Clear follow-up implementation map exists with impacted files and rollout path.

---

## Recommended implementation sequencing (next code PRs)
1. Build shared Race Hub selector + UI component.
2. Drop into Schedule + Coaching first.
3. Update nav IA labels/order.
4. Add Plan surface + race edit links.
5. Validate consistency of countdown/phase across pages.

This sequencing keeps scope manageable for solo-builder velocity while maximizing perceived product cohesion early.