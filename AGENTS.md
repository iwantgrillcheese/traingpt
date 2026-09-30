# AGENTS.md — Brick / TrainGPT

## What this repo is

This repository is the production codebase for **Brick**, formerly called **TrainGPT**.

Brick is an adaptive endurance training platform for runners and triathletes.

Repository:
`iwantgrillcheese/traingpt`

The product already has real users. Treat existing behavior, user data, training history, and working UI as production systems — not disposable prototypes.

Do not casually rebuild working systems from scratch.

---

## Product mission

Brick should feel like an intelligent endurance coach that understands:

- what event the athlete is training for
- their current fitness
- their real training history
- what training they actually complete
- their schedule and life constraints
- how their training should change over time

The long-term product goal is:

> The athlete tells Brick what changed. Brick understands what that means for their training.

We value:

1. trustworthy training plans
2. simple athlete UX
3. useful adaptation
4. explainability
5. retention through genuine coaching value
6. systems that scale to 100k+ athletes

---

## Primary user groups

Brick supports:

- runners
- triathletes

Running and triathlon are both first-class product categories.

Supported event types include running races and triathlon distances.

Do not design the product as triathlon-only unless the feature is inherently triathlon-specific.

---

## Tech stack

Frontend:

- Next.js
- React
- React Server Components where appropriate
- TypeScript
- TailwindCSS
- mobile-first responsive design

Backend:

- Supabase
- Postgres
- Supabase Auth
- Supabase migrations
- Edge/server routes where appropriate

AI:

- OpenAI APIs
- structured outputs where deterministic schemas are required

Infrastructure:

- Vercel
- GitHub

Analytics:

- PostHog

External training data:

- Strava

There is also mobile code in the repository. When changing shared training behavior, check whether mobile relies on the same data or helpers.

---

# Core architectural rule

## Deterministic training logic owns the plan structure

Do not let an LLM independently decide critical scheduling behavior when deterministic code can do it reliably.

The deterministic engine should own things such as:

- workout dates
- sports
- session duration
- periodization
- weekly training load
- taper behavior
- deloads
- availability constraints
- rest days
- preferred long-session days
- hard scheduling constraints
- adherence calculations
- adaptation guardrails

The LLM is useful for:

- interpreting natural language
- enriching session instructions
- coaching explanations
- describing why a workout exists
- translating structured training logic into athlete-friendly language

A useful mental model is:

```text
athlete data
→ structured athlete state
→ deterministic training logic
→ valid schedule
→ AI enrichment / explanation

Not:
athlete data
→ giant prompt
→ hope GPT produces a good plan

Plan generation
Plan generation is one of the most important systems in Brick.
Relevant code has historically included files such as:
- app/plan/page.tsx
- app/api/finalize-plan/route.ts
- utils/buildTriathlonScaffold.ts
- utils/buildRunningScaffold.ts
- utils/buildCoachPrompt.ts
- utils/buildRunningPrompt.ts
- utils/enforceTriathlonScheduleConstraints.ts
- utils/enforceTriathlonTimeBudget.ts
- utils/validateGeneratedPlan.ts
- utils/repairGeneratedPlan.ts
- types/plan.ts
Always inspect the current repo before assuming these paths or implementations are unchanged.
Plan quality principles
A training plan should show sensible progression across:
Base
→ Build
→ Peak
→ Taper

Deload weeks may temporarily reduce volume.
After a deload, progression should resume.
A normal Base or Build week should not unexpectedly collapse into tiny sessions.
For a healthy supported plan:
- long sessions should remain meaningful
- session durations should be useful
- weekly volume should broadly match athlete availability
- taper should reduce load close to race day
- the plan should not rely on a final limiter to rescue wildly oversized weeks
Weekly time budget
The athlete's weekly-hour limit is a real constraint.
However:
The generator should create a plan that already fits the athlete's available hours.
The weekly time-budget guard should be a safety rail, not the primary planning mechanism.
Do not create a 14-hour week for a 10-hour athlete and then shrink every workout to make it fit.
Protect anchor-session integrity.
Athlete scheduling constraints
Brick may support structured athlete constraints such as:
- rest day
- globally unavailable days
- sport-specific availability
- preferred long-run day
- preferred long-ride day
- two-a-day tolerance
- recurring commitments
- days to avoid hard training
- secondary events
Hard constraints must be enforced by deterministic scheduling logic.
Example:
If an athlete can only swim Wednesday and Thursday:
Do not schedule swims on other days.
If constraints cannot all be satisfied, surface the conflict.
Do not silently violate a hard constraint.
Athlete comments / natural language
Brick collects athlete comments / notes.
The long-term architecture is:
athlete comment
→ AI structured interpretation
→ athlete confirmation
→ persisted structured constraints
→ deterministic plan engine

Do not treat free-text comments as instructions that GPT should loosely remember during plan generation.
Examples:
"I can only swim Wednesday and Thursday."

Should become a structured hard availability rule.
"I'd rather long run Sunday."

Should become a preference.
"I sometimes play soccer Tuesday."

Should remain context unless the wording clearly establishes a recurring commitment.
"My knee sometimes hurts."

Do not invent medical rules. Preserve it as context unless the product explicitly supports a relevant athlete-controlled constraint.
When using AI to interpret comments:
- use structured output
- only allow supported fields
- validate server-side
- do not silently guess ambiguous constraints
- preserve the original athlete text
Multiple events
Brick may support:
- one primary event
- one optional secondary event
Do not implement unlimited simultaneous goals unless explicitly requested.
The secondary event modifies one coherent training plan.
Do not generate two independent training plans and stack them.
The primary event remains the main periodization anchor.
Example:
70.3 + Marathon
The plan may increase run durability while still preserving necessary bike and swim training.
It must still respect:
- weekly hours
- recovery
- tapering
- session spacing
- athlete availability
Weekly adaptation
Brick adapts future training based on completed training.
Relevant code has historically included:
- app/api/adapt-week/route.ts
- utils/adaptNextWeek.ts
Adaptation must distinguish between:
- workout actually missed
- workout completed early
- workout completed on another day
- workout moved
- workout matched through Strava
- athlete legitimately paused
- athlete unavailable because of travel/life
Do not equate:
not completed on original scheduled date

with:
not completed

That distinction is critical.
Never repeatedly punish an athlete's future training load because of a bookkeeping mismatch.
Completion identity
Session completion should prefer stable session identity.
Do not rely solely on:
date + title

when a direct session ID exists.
Preserve compatibility with historical completion records.
Planned date and actual completion date are different concepts.
Example:
planned: Thursday
completed: Wednesday

The workout should remain associated with the Thursday plan session while counting as completed.
Strava
Strava is a core Brick integration.
Strava is used for:
- importing training history
- athlete insights
- workout matching
- completion detection
- training analysis
- plan personalization
Do not break Strava behavior while modifying plan logic.
Preserve:
- historical activities
- ownership/user scoping
- sync state
- duplicate protection
- completion matching
When working with Strava-derived athlete insights, distinguish between:
what the data proves
and
what sounds impressive.
For example:
Most lifetime training hours being on the bike means:
bike-heavy training history

It does not automatically mean:
cycling is the athlete's strongest physiological discipline

Avoid overclaiming.
Brick Athlete Profiles
Brick may derive deterministic athlete archetypes from Strava history.
Examples include profiles such as:
- The Diesel
- The Engine
- The Grinder
- The All-Rounder
- The Weekend Warrior
- The Big Day Specialist
- The Comeback
These should describe observable training behavior.
They must be:
- deterministic
- explainable
- evidence-backed
- based on multiple signals where possible
Do not use an LLM to arbitrarily assign athlete profiles.
The label is presentation.
Underlying metrics should drive training logic.
Pausing training
Real athletes get:
- sick
- injured
- busy
- traveling
- interrupted by life
Brick should handle this deliberately.
A pause should not be interpreted as weeks of poor adherence.
Never delete prior training history when pausing or resuming.
Future training may be adjusted conservatively.
Do not provide medical clearance or imply that an athlete is medically safe to resume.
Schedule / calendar UX
The training schedule is the main product surface.
The month calendar is the primary schedule view.
Avoid adding unnecessary alternate schedule modes unless specifically requested.
The calendar should visually dominate the page.
On desktop, avoid stacking so much status/dashboard UI above the calendar that the actual calendar disappears below the fold.
General design rules:
- mobile-first
- compact but readable
- strong hierarchy
- premium endurance aesthetic
- preserve existing Brick design language
Avoid:
- excessive pills/chips
- generic SaaS dashboard cards
- huge empty padding
- unnecessary gradients
- decorative UI without function
- rebuilding existing screens without a strong reason
If asked to improve an existing screen:
improve the existing design rather than replacing it wholesale.
Brand
Product name:
Brick
Legacy name:
TrainGPT
The repository and some internal identifiers may still use TrainGPT.
Do not rename internal systems casually just for cosmetic consistency.
Brand direction:
- athletic
- premium
- modern
- understated
- confident
- not childish
- not overly "AI"
Avoid generic AI visuals.
Product philosophy
Before adding complexity, ask:
1. Does this make training more trustworthy?
2. Does it help the athlete stay engaged?
3. Does it make Brick meaningfully better than a static plan?
4. Does it create useful proprietary athlete state/data?
5. Is there a simpler implementation?
Do not build features merely because they are technically interesting.
Backward compatibility
There are real existing athletes and plans.
Changes must preserve existing data.
For migrations:
- make them backward-compatible
- do not delete historical data
- support legacy plan shapes where practical
- avoid requiring all historical records to have new fields
New optional features should not change behavior for athletes who do not use them.
Database changes
Use proper Supabase migrations.
Do not make undocumented production-only schema changes.
When introducing new fields:
- consider existing rows
- provide safe defaults where appropriate
- make reads tolerant of legacy null values
- keep writes typed
Analytics
Use existing PostHog helpers/patterns.
Track meaningful product behavior, not noise.
Do not send sensitive raw athlete notes or unnecessary raw training data to analytics.
Prefer properties such as:
- feature used
- rule type
- success/failure
- count
- bucket/category
Engineering style
Use:
- TypeScript
- strong typing
- small reusable helpers
- clear names
- existing architectural patterns
- deterministic pure functions where practical
Avoid:
- any unless truly necessary
- duplicated business logic
- giant route handlers
- new dependencies without a strong reason
- unrelated refactors during feature work
- parallel implementations of an existing system
Before creating something new:
search the repository to determine whether the capability already exists.
Testing expectations
Training logic requires deterministic regression tests.
When modifying plan generation, test representative plans across:
- race types
- weekly hour caps
- experience levels
- short and long plan durations
- constrained availability
- secondary goals when relevant
Inspect week-by-week progression.
Useful plan diagnostics include:
- week number
- phase
- deload
- number of sessions
- total weekly minutes
- longest ride
- longest run
- key workout durations
- whether any post-processing modified the week
When available, run the repository's existing:
- plan-quality tests/matrix
- plan reliability tests
- typecheck
- lint
- relevant unit tests
- production build
Do not claim success if these fail.
Working process
For substantial tasks:
1. inspect the existing implementation
2. identify what already exists
3. identify the smallest correct change
4. note schema/backward-compatibility risks
5. implement incrementally
6. test the actual user scenario
7. check for regressions
8. summarize what changed
Do not immediately start rewriting code before understanding the current architecture.
Founder workflow
The founder is a strong product thinker and is newer to software engineering.
When reporting work:
Be concise and concrete.
Explain:
- what was wrong
- what changed
- why the implementation is safe
- what needs manual testing
- any migration needed
- any remaining edge cases
Do not bury important product decisions in implementation jargon.
Git / deployment rules
Unless explicitly instructed otherwise:
- do not merge automatically
- do not deploy production automatically
- do not delete branches
- do not rewrite unrelated history
At the end of a task provide:
- files changed
- migrations added
- tests run
- test results
- manual test checklist
- known limitations
Most important rule
Brick earns trust when the product does what it told the athlete it would do.
Prefer a smaller feature that is deterministic and reliable over a more impressive feature that sometimes lies.