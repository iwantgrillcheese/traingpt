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