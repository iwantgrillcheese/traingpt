// utils/buildRunningPrompt.ts
import { addDays, format } from "date-fns";
import type { WeekMeta, UserParams, DayOfWeek } from "@/types/plan";

const dayName = (d: number) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d];

function unitLabel(unit: "mi" | "km") {
  return unit === "km" ? "per km" : "per mile";
}

function unitSuffix(unit: "mi" | "km") {
  return unit === "km" ? "/km" : "/mi";
}

type RunReadiness = "true_beginner" | "base_built" | "advanced";


function weekDateList(startDateISO: string) {
  const start = new Date(`${startDateISO}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

function inferReadiness(userParams: UserParams, prevSummary?: { prevWeeklyMin?: number }): RunReadiness {
  const exp = (userParams.experience ?? "").toLowerCase();
  const prevMin = prevSummary?.prevWeeklyMin ?? 0;

  if (exp.includes("advanced")) return "advanced";
  if (exp.includes("intermediate")) return prevMin >= 120 ? "base_built" : "true_beginner";
  return prevMin >= 150 ? "base_built" : "true_beginner";
}

function rampCaps(readiness: RunReadiness, weekIndex?: number) {
  const i = typeof weekIndex === "number" ? weekIndex : 0;
  const inRamp = i <= 2; // Weeks 1–3

  if (readiness === "advanced") {
    return {
      inRamp: false,
      maxSingleRunMin: 120,
      maxLongRunMin: 150,
      maxWeeklyMin: 500,
      maxQualityDays: 2,
      maxQualityMin: 90,
      minRunsPerWeek: 5,
      maxRunsPerWeek: 6,
    };
  }

  if (readiness === "base_built") {
    return {
      inRamp,
      maxSingleRunMin: inRamp ? 60 : 90,
      maxLongRunMin: inRamp ? 75 : 120,
      maxWeeklyMin: inRamp ? 220 : 380,
      maxQualityDays: inRamp ? 1 : 2,
      maxQualityMin: inRamp ? 25 : 60,
      minRunsPerWeek: 4,
      maxRunsPerWeek: 5,
    };
  }

  return {
    inRamp: true,
    maxSingleRunMin: 45,
    maxLongRunMin: 60,
    maxWeeklyMin: 180,
    maxQualityDays: 1,
    maxQualityMin: 20,
    minRunsPerWeek: 3,
    maxRunsPerWeek: 4,
  };
}

export function buildRunningPrompt({
  userParams,
  weekMeta,
  index,
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
  const longRunDay = (prefs.longRunDay ?? 0) as DayOfWeek;

  const paceUnit: "mi" | "km" = userParams.paceUnit === "km" ? "km" : "mi";
  const paceSuffix = unitSuffix(paceUnit);
  const weekDates = weekDateList(weekMeta.startDate);

  const readiness = inferReadiness(userParams, prevSummary);
  const caps = rampCaps(readiness, index);

  const requestedWeekly = targets?.targetWeeklyMin ?? 0;
  const requestedLong = targets?.targetLongRunMin ?? 0;
  const requestedLRMax = targets?.longRunMax ?? 0;
  const requestedQualityDays = targets?.qualityDays ?? 0;
  const requestedQualityMin = targets?.maxQualityMin ?? 0;

  const effectiveWeeklyTarget =
    requestedWeekly > 0 ? Math.min(requestedWeekly, caps.maxWeeklyMin) : caps.maxWeeklyMin;

  const effectiveLongTarget =
    requestedLong > 0 ? Math.min(requestedLong, caps.maxLongRunMin) : caps.maxLongRunMin;

  const effectiveLongMax =
    requestedLRMax > 0 ? Math.min(requestedLRMax, caps.maxLongRunMin) : caps.maxLongRunMin;

  const effectiveQualityDays =
    requestedQualityDays > 0 ? Math.min(requestedQualityDays, caps.maxQualityDays) : caps.maxQualityDays;

  const effectiveQualityMin =
    requestedQualityMin > 0 ? Math.min(requestedQualityMin, caps.maxQualityMin) : caps.maxQualityMin;

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

## Pace Units (STRICT)
- Use ONLY ${paceSuffix} in all pace ranges. Do NOT output the other unit.

## Metrics
- Run Threshold Pace: ${userParams.runPace ?? "unknown"} (interpret in ${unitLabel(paceUnit)} if provided)

## Previous Week (for progression)
- Previous weekly run minutes: ${prevSummary?.prevWeeklyMin ?? "unknown"}
- Previous long run minutes: ${prevSummary?.prevLongRunMin ?? "unknown"}

## Readiness (STRICT)
- Run readiness tier: ${readiness}
- Ramp mode: ${caps.inRamp ? "ON" : "OFF"}

## Safety Caps (HARD RULES — override targets if needed)
- Max single run duration this week: ≤ ${caps.maxSingleRunMin}min
- Max long run duration this week: ≤ ${caps.maxLongRunMin}min
- Max total weekly run time this week: ≤ ${caps.maxWeeklyMin}min
- Runs per week: ${caps.minRunsPerWeek}–${caps.maxRunsPerWeek} run days (do NOT exceed)
- Quality days: ≤ ${caps.maxQualityDays} (and never back-to-back)
- Total quality time: ≤ ${caps.maxQualityMin} minutes

## Weekly Targets (STRICT, but clamped by Safety Caps)
- Total running time: ${effectiveWeeklyTarget} minutes (±5%)
- Long run: ${effectiveLongTarget} minutes target (do not exceed ${effectiveLongMax} minutes)
- Quality sessions: max ${effectiveQualityDays} days
- Total quality time: ≤ ${effectiveQualityMin} minutes
- No back-to-back hard run days
- Avoid doubles (2 run sessions in one day) unless Experience is Advanced
- Longest run (by duration) must land on Long Run Day

## Week Layout Requirements (STRICT)
- You MUST return exactly these date keys and no others: ${weekDates.join(", ")}
- Keep at least one full recovery day ([] or ["Rest"]).
- Distribute running load across the week; avoid front-loading volume early in the week.
- Long run should generally be 1.4x–2.2x an easy-day run duration (unless taper constraints require shorter).

## Quality Guidance by Phase
- Base: one light quality touch only (short tempo, strides, or gentle hills).
- Build: one primary quality workout + optional secondary lighter stimulus.
- Peak: quality is race-specific and controlled; maintain freshness for key sessions.
- Taper: reduce volume and keep only brief sharpening.

## True Beginner Rules (if readiness is true_beginner)
- Weeks 1–3 must prioritize consistency, not volume.
- Use run/walk option language if helpful (still include total duration).
- No long tempos. Only short strides/hills once per week max.

## Output format (REQUIRED)
- Return ONLY valid JSON matching WeekJson schema.
- Use date keys "YYYY-MM-DD" for the week starting at startDate (Mon→Sun).
- Each date has an array of session strings.
- Every RUN session string MUST include a duration: "45min", "1h", "2 hours", or "1:15".
- Use em dash/en dash separators (— or –) between segments.
- Prefer ending each session with "— Details".
- Rest day should be [] OR ["Rest"].

## Session writing examples (style + unit ${paceSuffix})
- "🏃 Run — 35min easy (around 8:00–9:15${paceSuffix}) — Details"
- "🏃 Run — 40min easy + 4x20s strides — Details"
- "🏃 Long Run — 50min steady (around 8:00–9:00${paceSuffix}) — Details"

Now generate the week so it satisfies ALL targets and rules.
`.trim();
}
