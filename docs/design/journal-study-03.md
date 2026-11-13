# TrainGPT — Training Journal / Design Study 03

**Stage:** isolated interactive design exploration. Not for merge or production usage.

**Visual hypothesis:** Training should feel like a journal of meaningful work, not a generic SaaS dashboard. The visual signature is the *weekly rhythm*: one quantified training-volume strip, a scan-friendly seven-day log, and a focused reading surface that explains the selected workout.

## References and translation

- **Linear:** information hierarchy, scannable list rows, low-contrast page structure, restrained status. Do not clone its sidebar.
- **Granola:** calm visual voice, direct copy, quiet tool chrome, editorial confidence for brief explanation.
- **Framer:** bold hierarchy/composition and purposeful contrast, particularly when a large graphic or typography improves comprehension.

## Design decisions

1. **Week first, month still available.** The athlete's actionable horizon is the next seven days, but calendar navigation remains available via an interactive month control.
2. **Activity content is a line of text, not a chip.** Day/date, sport, workout name and time stay scan-friendly. No pill backgrounds or sport colors.
3. **The day inspector is a contrasting reading surface, not a status card.** It shows what matters: workout title, duration, status, execution context, and a coaching explanation.
4. **The weekly time spectrum represents actual example workout minutes.** It is NOT labelled training load, fatigue, readiness, or adaptation.
5. **Mobile is a daily experience.** Today is rebuilt around one date, a seven-day selector, a readable workout list, and a coaching message.
6. **Color is scarce but purposeful.** Indigo for selection and focus, desaturated green for completion, neutrals for everything else.
7. **No cosmetic media, no giant slogans, no workouts made up from athlete data.**

## Sample color foundation

| Meaning | Token |
| --- | --- |
| Background | #F8F9F8 |
| Main ink | #20232B |
| Contrast inspector | #1B1E24 |
| Quiet label | #8C919A |
| Hairline | #E4E6E8 |
| Focus | #525BDB |
| Completion | #17856A |

UI font: Inter / Inter Display. Serif only in the short coaching rationale. All source and styling are scoped in a standalone HTML experiment; do not treat this as the production design system yet.

## Interactive prototype

Branch: `design/traingpt-journal-study-03`

Preview path: `/design/traingpt-journal-study-03.html`

Desktop: weekly volume strip, day selection, session selection, week pagination, week/month switching, and inspector collapse.

Mobile: date selection, workout expansion, and a bottom navigation *visual reference* (not functional product nav yet).

Data is clearly labelled sample data. The prototype makes no Supabase or Strava requests and does not render sensitive live athlete information.

## QA performed

- Chromium 1600x960, 1280x900 and 390x844 render inspections via Playwright.
- Found/fixed a mobile layout bug hiding the preview behind a full-height desktop wrapper.
- Tested month grid (42 day cells), return to week, day selection, inspector collapse, and mobile date navigation.
- Checked for JS page errors and horizontal viewport overflow at desktop and mobile widths.

## Explicit non-goals

No plan generation changes, Strava changes, route changes, authentication changes, scheduling changes, or production rollout. Existing visual experiments PR #154 and PR #155 should remain untouched.

## Integration strategy (after visual approval)

Build a typed React design system behind a visual feature flag using the existing Schedule data model. Reuse session completion/matching, race plans, pause logic, calendar interactions, export, Strava modals and athlete settings. Make month-first vs week-first an actual product decision informed by athlete behavior, not just aesthetics. Add stateful polish progressively, gated by mobile regression testing and performance.
