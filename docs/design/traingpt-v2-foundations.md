# TrainGPT 2.0 — Visual Foundations / Exploration 01

**Status:** design exploration; not approved for production implementation.

**Reference pillars:** Linear (interface discipline), Granola (personality through typography and a human voice), Framer (visual composition and motion). This is an original TrainGPT system, not a copy of their UI.

## Positioning

A beautifully designed training instrument for runners and triathletes. Competence without noise. Training progression is the signature visual idea: what was planned, what was done, what changes next, and why.

## Palette (concept tokens)

| Token | Hex | Purpose |
| --- | --- | --- |
| `--v2-ink` | `#161820` | Foreground and primary contrast |
| `--v2-paper` | `#FFFFFF` | Main surfaces |
| `--v2-mist` | `#F5F6F8` | Secondary surfaces, never blanket gray-on-gray |
| `--v2-line` | `#E5E7EC` | Hairline structure |
| `--v2-quiet` | `#737987` | Subordinate labels |
| `--v2-blue` | `#435CF4` | Focus, navigation, current training phase, selected dates |
| `--v2-blue-pale` | `#EEF0FF` | Selected/review context only |
| `--v2-done` | `#1C8563` | Genuine completion only |

**Color is semantic, not sport-based.** No individual orange bike, teal swim, purple strength, black run cards. Neutral is the default, blue indicates focus or selection, green indicates a completed workout. Errors must be visually distinguishable and cannot be suppressed merely to make the interface clean.

## Typography

- **UI:** Inter (existing installed app font), regular/medium/semibold, with tight display tracking and normal body tracking.
- **Editorial voice:** Newsreader, reserved for short coaching insights and editorial marketing moments. Never for dense data, labels, or form controls.
- **Numbers:** tabular when used for progress, dates, times, pacing.
- **Hierarchy:** page heading / section marker / workout title / relevant metadata. Avoid unnecessary uppercase labels everywhere.

## Geometry and behavior

- Borders are hairlines. Prefer whitespace to heavy boxes.
- Core radius 6–10 px. Avoid every piece of content becoming a floating 20+ px card.
- Date selection should be unmistakable and keyboard accessible.
- A completed workout's meaning must survive grayscale and screen-reader output.
- Respect reduced-motion preferences.
- No decorative images, sport emojis, colored edge rails, fake urgency, or AI-themed shimmer.
- Do not add a global status banner for a healthy Strava connection. Preserve access to sync controls and surface actual failures.
- Use training progress as a coherent visual motif instead of redundant charts.

## First screens

1. **Desktop Schedule** — month-first training ledger, integrated day inspector, optional collapse, responsive agenda. Visual prototype includes selectable days, working month navigation, display mode, and panel collapse.
2. **Mobile Today** — singular day focus, week selector, expandable workout content, short coaching note, bottom-navigation reference.
3. **System** — actual proposed colors, type hierarchy, specimen patterns, and 16-week training motif.

The review route is `/design/traingpt-v2`, intentionally outside normal app navigation. It renders **representative sample sessions only**, with no Supabase reads or athlete-state changes.

## Integration constraints (next stage, after visual approval)

- Reuse `CalendarShellV2`, the plan store, `MergedSession` matching, `SessionModal`, existing schedule API calls, and Strava activity modals.
- Preserve completion identity, moved workouts, pause semantics, and drag/drop.
- Preserve mobile-specific execution targets and post-workout Strava insights.
- Plan view: periodization chapters and schedule changes.
- Progress view: truthful training/adherence data, not generic placeholder KPI cards.
- Coach view: calm conversational workspace with structured coaching evidence.

## Review gate

Evaluate against an actual 1440 px desktop viewport and a 390 px mobile viewport. Check long workout titles, 0/1/2/3 workouts in a day, accessible focus/contrast, narrow desktop, panel collapse, and realistic training text. No production rollout before approval. Do not merge the superseded calendar PR #154 for visual design.
