# TrainGPT Product Cohesion Audit

## Scope
This audit reviews these end-to-end flows based on current product behavior and code paths:
1. New user onboarding
2. Plan generation flow
3. Calendar + session workflow
4. Coaching/chat integration
5. Strava integration
6. Dashboard metrics
7. Race anchoring and race-day preparation
8. Navigation and information architecture

---

## 1) Current user journey (step-by-step)

### A. New user onboarding
1. User lands on `/` marketing page.
2. User clicks CTA and signs in via Google (`/login` → Supabase OAuth).
3. OAuth callback redirects to `/plan`.
4. User enters race details/training inputs (or quick mode if Strava connected).
5. User submits plan generation (`/api/finalize-plan`).
6. App polls for sessions readiness.
7. User is redirected to `/schedule?walkthrough=1`.
8. User interacts with calendar/session modal and can mark sessions complete.

### B. Plan generation
1. Inputs are collected from form (race type/date, availability, experience, optional performance fields).
2. Existing plan context may prefill from latest saved plan.
3. Strava summary may influence defaults/estimates.
4. Plan is generated and converted into sessions.
5. Sessions become the operational center in Schedule.

### C. Calendar + session workflow
1. User views sessions in `/schedule`.
2. Sessions are merged with Strava activities (match/completion context).
3. User opens SessionModal.
4. User can:
   - read planned details
   - generate detailed workout (`/api/generate-detailed-session`)
   - add notes/feelings
   - add fueling guidance
   - mark done/undo
5. Completed sessions and Strava-derived status update downstream views.

### D. Coaching/chat
1. User opens `/coaching` dashboard.
2. Weekly summaries and performance cards are derived from planned/completed/Strava data.
3. User can open coach chat modal and ask freeform questions (`/api/coach-chat`).
4. User can analyze specific Strava activities (`/api/strava/analyze`).

### E. Strava integration
1. User connects Strava from banner/CTA.
2. Callback stores tokens in profile.
3. Sync endpoint imports recent activities and normalizes sport types.
4. Imported activities feed:
   - schedule completion context
   - coaching metrics
   - plan regeneration hints.

### F. Race anchoring
1. User chooses race type/date manually or from `/races` finder.
2. Plan uses race date to set timeline/phases.
3. Post-generation, race context is not strongly surfaced as a persistent “north star” object across all pages.

---

## 2) Where the experience feels fragmented or redundant

1. **Entry-point split**
   - Navigation labels “Plan Generator” as home while operational workflow really lives in Schedule + Coaching.
   - New users can infer product = generator, not race-prep system.

2. **Race context is weakly persistent**
   - Race is captured during plan creation but not consistently promoted in app chrome and daily workflows.
   - Race-day countdown/progression is not a first-class, always-visible anchor.

3. **Plan flow and calendar flow are loosely coupled**
   - Plan generation is a separate moment; then users are dropped into schedule with limited “why this week” continuity.
   - Walkthrough exists, but continuity feels modal-triggered rather than structural.

4. **Coaching context not tightly integrated into Schedule actions**
   - Chat sits in Coaching page/modal; actionable insights aren’t always injected into session-level decisions.

5. **Inconsistent data model hints (legacy naming)**
   - Multiple places normalize older/new field names (`date` vs `session_date`, `title` vs `session_title`), signaling technical and conceptual drift.

6. **Strava appears as connection utility, not a training narrative**
   - Sync/connect UI is clear, but Strava data is consumed mostly as metrics ingestion vs athlete story/progression.

7. **Dashboard metrics are useful but not race-outcome-linked**
   - Performance widgets show volume/adherence trends, but “Are you on track for race goal?” is not explicit.

---

## 3) Missing features for a cohesive race-training experience

1. **Persistent Race Hub (global)**
   - Race card visible across app: event, days-to-race, phase, confidence/on-track status.

2. **Macro-to-micro alignment**
   - Each week should clearly map to race phase objective (Base/Build/Peak/Taper intent made explicit in schedule UI).

3. **On-track forecasting**
   - Lightweight race-readiness model combining consistency, key workouts, and recent trend.

4. **Session intent + outcome loop**
   - Every session should show planned objective and post-session “did this achieve intended adaptation?”

5. **Race-day readiness checklist**
   - Pacing, fueling rehearsal completion, transitions, taper checklist, logistics readiness.

6. **Coach memory surfaced in product UI**
   - Key athlete constraints/preferences should be visible and editable in one place, reflected in plan/sessions/coaching.

7. **Unified onboarding runway**
   - After first login, guided setup should include race selection, current baseline, constraints, Strava connect, and first-week confidence check.

---

## 4) High-impact UX improvements

1. **Introduce a “Race Command Center” strip at top of Schedule + Coaching**
   - Event name/date, countdown, current phase, weekly focus, readiness indicator.

2. **Restructure navigation around athlete journey**
   - Suggested top-level: **Today**, **Plan**, **Race**, **Insights**, **Settings**.
   - Keep generator under Plan, not as core nav brand.

3. **Make weekly focus explicit in calendar**
   - Add week objective + key sessions badges.

4. **Embed coaching prompts at decision points**
   - In SessionModal and Schedule context panel: “Adjust this workout?”, “What should tomorrow look like after this effort?”

5. **Add race-progression timeline**
   - Visual phase rail (Base→Build→Peak→Taper) with where user is now and what to prioritize.

6. **Tighten design system consistency across pages**
   - Harmonize card hierarchy, status chips, and action button language between Plan/Schedule/Coaching.

7. **Outcome-first dashboard cards**
   - Translate raw metrics into statements like: “You’re on track / at risk for race goal because…”.

---

## 5) Prioritized roadmap

### High (next 2–4 weeks)
1. **Race Command Center** across Schedule + Coaching.
2. **Navigation IA refresh** to align with race-prep workflow.
3. **Weekly focus + key session emphasis** in calendar.
4. **Session-level coach assist entry points** (contextual, not separate destination).
5. **Data model cleanup pass plan** (standardize session/completion fields and naming).

### Medium (1–2 months)
1. **On-track/readiness scoring** linked to goal race.
2. **Race-day prep module** (checklists + rehearsal milestones).
3. **Unified onboarding wizard** (race → baseline → constraints → Strava → first week).
4. **Coach memory/preferences UI** with clear propagation to plan generation.

### Low (later / polish)
1. **Advanced narrative analytics** (e.g., trend storytelling over cycles).
2. **Deeper race discovery/selection UX** with richer event metadata.
3. **Theme/visual refinements** once IA and workflow cohesion are stabilized.

---

## 6) Product cohesion north-star

TrainGPT should feel like:
- not “a plan generator with extra pages,”
- but **a race preparation operating system** that continuously links:
  **race goal → weekly intent → daily execution → coach feedback → race readiness**.

That single chain should be visible in every primary workflow.
---

## Execution Roadmap (Solo Builder, 6 Weeks)

### Planning assumptions
- Solo builder velocity, incremental weekly slices.
- No large architectural rewrites in a single sprint.
- Prioritize visible user-value and race-prep cohesion over backend perfection.

## Sprint 1 (Week 1): Establish the Race Anchor Everywhere

**Sprint goal**
Make the race goal persistent and visible so every core page feels tied to one mission.

**Features to ship**
- Add a reusable **Race Command Center** strip to Schedule + Coaching + Plan.
- Display: race name/type, race date, days-to-race, current phase (Base/Build/Peak/Taper), weekly focus text.
- Add fallback empty-state CTA when no race context exists.

**Files/systems likely impacted**
- `app/components/Layout.tsx`
- New shared component: `app/components/RaceCommandCenter.tsx`
- `app/schedule/page.tsx`
- `app/coaching/CoachingClient.tsx`
- `app/plan/page.tsx`
- Supabase reads from `plans` (latest active plan)

**Acceptance criteria**
- Race strip appears on Plan, Schedule, and Coaching for authenticated users with a plan.
- Countdown and phase are consistent across pages.
- If no plan exists, clear CTA routes to plan setup.
- No regressions in page load/auth flows.

---

## Sprint 2 (Week 2): Tighten IA + Navigation to Match User Journey

**Sprint goal**
Align navigation with race-preparation workflow (not just feature buckets).

**Features to ship**
- Update nav labels/order to a clearer journey:
  - Today (Schedule)
  - Plan
  - Insights (Coaching)
  - Race
  - Settings
- Add active-page context labels/subtitles to reduce “where am I?” ambiguity.
- Ensure CTA paths from landing/login route users into the right first task.

**Files/systems likely impacted**
- `app/components/Layout.tsx`
- `app/page.tsx` (marketing CTAs)
- `app/login/page.tsx`
- `app/races/page.tsx`

**Acceptance criteria**
- Navigation language is consistent across desktop/mobile drawer.
- New users can get from login to first workout context in ≤3 clicks.
- No dead links or route mismatches.

---

## Sprint 3 (Week 3): Connect Weekly Intent to Daily Execution

**Sprint goal**
Make schedule weeks explain *why* each week/session exists in the race build.

**Features to ship**
- Add weekly objective banner in Schedule (e.g., “Build aerobic durability”).
- Mark 1–3 **key sessions** each week in calendar/session views.
- In SessionModal, show “This session contributes to: [weekly objective]”.

**Files/systems likely impacted**
- `app/schedule/page.tsx`
- `app/schedule/CalendarShell.tsx`
- `app/schedule/DesktopContextPanel.tsx`
- `app/schedule/SessionModal.tsx`
- Plan/session metadata mapping utilities (likely `utils/*` and `types/*`)

**Acceptance criteria**
- Weekly objective visible for current week.
- At least one key session highlighted when plan provides signal.
- Session modal always shows contextual purpose text.
- No breakage to existing completion/notes/generation actions.

---

## Sprint 4 (Week 4): Embed Coaching at Decision Points

**Sprint goal**
Move coaching from separate destination to in-flow support.

**Features to ship**
- Add contextual coach prompts in Schedule and SessionModal:
  - “Adjust this workout for fatigue?”
  - “What should tomorrow look like after this?”
- Pre-fill coach modal with session/race context when launched from session UI.
- Add a compact “Coach recommendation for this week” card in Schedule.

**Files/systems likely impacted**
- `app/components/CoachChatModal.tsx`
- `app/schedule/SessionModal.tsx`
- `app/schedule/DesktopContextPanel.tsx`
- `app/coaching/CoachingClient.tsx`
- `app/api/coach-chat/route.ts` (prompt/context packaging)

**Acceptance criteria**
- Coach can be invoked from session workflow without leaving context.
- Prefilled prompt includes session + phase context.
- Coach response quality remains stable (no blank/irrelevant responses).

---

## Sprint 5 (Week 5): Race-Readiness Signals + Outcome Framing

**Sprint goal**
Turn metrics into race-outcome guidance (“on track / at risk / improving”).

**Features to ship**
- Add race-readiness status card combining:
  - adherence trend
  - recent load consistency
  - key workout completion
- Add human-readable explanation: “You’re on track because…”
- Add risk flags (e.g., missed key sessions, declining consistency).

**Files/systems likely impacted**
- `app/components/CoachingDashboard.tsx`
- `app/coaching/FitnessPanel.tsx`
- `app/coaching/WeeklySummaryPanel.tsx`
- Derived metrics utilities (`utils/getWeeklySummary.ts`, `utils/getWeeklyVolume.ts`)

**Acceptance criteria**
- Readiness status shows one of: On Track / Watch / At Risk.
- Status explanation references concrete recent data.
- No contradictory messaging between dashboard cards.

---

## Sprint 6 (Week 6): Race-Day Preparation Module (Lightweight v1)

**Sprint goal**
Close the loop from training to race execution.

**Features to ship**
- Add race-day prep checklist:
  - pacing plan drafted
  - fueling plan rehearsed
  - key rehearsal workouts done
  - taper checklist complete
  - logistics complete
- Add checklist progress indicator in Race page and Race Command Center.
- Add simple reminder nudges in final 2 weeks.

**Files/systems likely impacted**
- `app/races/page.tsx`
- New component(s): `app/components/RacePrepChecklist.tsx`
- `app/components/RaceCommandCenter.tsx`
- Optional light persistence in Supabase (race_prep checklist state)

**Acceptance criteria**
- User can view/update checklist state.
- Checklist progress is visible in at least two key surfaces.
- Final-2-week nudge copy appears without disrupting core flows.

---

## Highest-impact-first summary
1. **Week 1–2:** Cohesion foundation (race anchor + IA).
2. **Week 3–4:** In-workflow clarity and coaching assistance.
3. **Week 5–6:** Outcome framing and race-day execution layer.

This sequence delivers immediate product coherence first, then compounds into better daily usability and race-readiness confidence.
