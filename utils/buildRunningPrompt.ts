// utils/buildRunningPrompt.ts
import type { WeekMeta, UserParams, DayOfWeek } from "@/types/plan";

const dayName = (d: number) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d];

export function buildRunningPrompt({
  userParams,
  weekMeta,
  index, // optional
  targets,
  prevSummary,
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index?: number;
  targets?: {
    targetWeeklyMin: number;
    targetLongRunMin: number;
    longRunMax: number;
    qualityDays: number;
    maxQualityMin: number;
    preferredLongRunDay: DayOfWeek;
  };
  prevSummary?: {
    prevWeeklyMin?: number;
    prevLongRunMin?: number;
  };
}) {
  const prefs = userParams.trainingPrefs ?? {};
  const longRunDay = (prefs.longRunDay ?? 0) as DayOfWeek; // default Sunday

  return `
You are creating ${weekMeta.label} for a RUNNING plan.

## Athlete
- Race: ${userParams.raceType}
- Race Date: ${userParams.raceDate}
- Experience: ${userParams.experience}
- Max Weekly Hours: ${userParams.maxHours}
- Rest Day: ${userParams.restDay}

## Week
- Label: ${weekMeta.label}
- Phase: ${weekMeta.phase}
- Start Date: ${weekMeta.startDate}
- Deload: ${weekMeta.deload ? "Yes" : "No"}

## Preferences
- Long Run Day (MUST FOLLOW): ${dayName(longRunDay)} (${longRunDay})

## Metrics
- Run Threshold Pace: ${userParams.runPace ?? "unknown"}

## Previous Week (for progression)
- Previous weekly run minutes: ${prevSummary?.prevWeeklyMin ?? "unknown"}
- Previous long run minutes: ${prevSummary?.prevLongRunMin ?? "unknown"}

## Weekly Targets (STRICT)
- Total running time: ${targets?.targetWeeklyMin ?? "TBD"} minutes (±5%)
- Long run: ${targets?.targetLongRunMin ?? "TBD"} minutes target (do not exceed ${targets?.longRunMax ?? "TBD"} minutes)
- Quality sessions: max ${targets?.qualityDays ?? "TBD"} days
- Total quality time: ≤ ${targets?.maxQualityMin ?? "TBD"} minutes
- No back-to-back hard run days
- Avoid doubles (2 run sessions in one day) unless Experience is Advanced
- Longest run (by duration) must land on Long Run Day

## Output format (REQUIRED)
- Return ONLY valid JSON matching WeekJson schema.
- Use date keys "YYYY-MM-DD" for the week starting at startDate (Mon→Sun).
- Each date has an array of session strings.
- Every RUN session string MUST include a duration: "45min", "1h", "2 hours", or "1:15".
- Use em dash/en dash separators (— or –) between segments.
- Prefer ending each session with "— Details" (consistent with the rest of the app).
- Rest day should be [] OR ["Rest"].

## Session writing examples (follow this style)
- "🏃 Run — 45min easy (around 5:15–5:30/km) — Details"
- "🏃 Run — 50min tempo (20min @ tempo around 4:25–4:30/km) — Details"
- "🏃 Run — 45min intervals (6x3min @ 5k effort, 2min easy) — Details"
- "🏃 Long Run — 90min steady (around 5:00–5:15/km) — Details"

## Guidelines by phase
- Base: mostly easy + strides/hills; 1 controlled quality session max.
- Build: 1–2 quality sessions (tempo/cruise/intervals), still mostly easy.
- Peak: race-specific sharpening, careful with total intensity.
- Taper: reduce volume, keep short intensity touches.
- Deload: reduce volume and intensity (short touch only).

Now generate the week so it satisfies ALL targets and rules.
`.trim();
}
