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

function weekDateList(startDateISO: string) {
  const start = new Date(`${startDateISO}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

function raceFamily(raceType?: string) {
  const s = String(raceType ?? "").toLowerCase();
  if (s.includes("marathon") || s.includes("26.2")) return "marathon";
  if (s.includes("half") || s.includes("13.1")) return "half";
  if (s.includes("10k")) return "10k";
  if (s.includes("5k")) return "5k";
  return "other";
}

function cycleMode(weeksToRace?: number | null) {
  if (weeksToRace == null) return "normal";
  if (weeksToRace < 4) return "race-readiness";
  if (weeksToRace < 8) return "protective";
  if (weeksToRace < 12) return "compressed";
  return "normal";
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
    minLongRunMin?: number;
    longRunMax: number;
    qualityDays: number;
    maxQualityMin: number;
    maxSingleRunMin?: number;
    preferredLongRunDay: DayOfWeek;
    raceFamily?: string;
    weeksToRace?: number | null;
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

  const raceKind = targets?.raceFamily ?? raceFamily(userParams.raceType);
  const wtr = targets?.weeksToRace ?? null;
  const mode = cycleMode(wtr);

  return `
You are creating ${weekMeta.label} for a RUNNING plan.

## Athlete
- Race: ${userParams.raceType}
- Race family: ${raceKind}
- Race Date: ${userParams.raceDate}
- Experience: ${userParams.experience}
- Max Weekly Hours: ${userParams.maxHours}
- Rest Day: ${userParams.restDay}

## Week
- Label: ${weekMeta.label}
- Phase: ${weekMeta.phase}
- Start Date: ${weekMeta.startDate}
- Deload: ${weekMeta.deload ? "Yes" : "No"}
- Weeks to race (approx): ${wtr ?? "unknown"}
- Cycle mode: ${mode}

## Preferences
- Long Run Day (MUST FOLLOW): ${dayName(longRunDay)} (${longRunDay})

## Pace Units (STRICT)
- Use ONLY ${paceSuffix} in all pace ranges. Do NOT output the other unit.

## Metrics
- Run Threshold Pace: ${userParams.runPace ?? "unknown"} (interpret in ${unitLabel(paceUnit)} if provided)

## Previous Week (for progression)
- Previous weekly run minutes: ${prevSummary?.prevWeeklyMin ?? "unknown"}
- Previous long run minutes: ${prevSummary?.prevLongRunMin ?? "unknown"}

## Weekly Targets (STRICT)
- Total running time: ${targets?.targetWeeklyMin ?? "unknown"} minutes (±5%)
- Long run target: ${targets?.targetLongRunMin ?? "unknown"} minutes
- Long run minimum floor: ${targets?.minLongRunMin ?? 0} minutes (if >0, do not go below)
- Long run maximum: ${targets?.longRunMax ?? "unknown"} minutes
- Max single run duration: ${targets?.maxSingleRunMin ?? "unknown"} minutes
- Quality days: ≤ ${targets?.qualityDays ?? "unknown"}
- Total quality minutes: ≤ ${targets?.maxQualityMin ?? "unknown"}
- Longest run must land on preferred long run day

## Marathon-specific principles (STRICT when race family is marathon)
- Long run is the backbone of the week and must be meaningfully developed outside taper.
- In Build/Peak, include marathon-specific stimulus (e.g., marathon-pace block within medium/long run) where appropriate.
- Do NOT undercook long runs in non-deload, non-taper weeks.
- Keep intensity controlled: usually one primary quality workout plus optional lighter quality.

## Short-cycle behavior by mode (STRICT)
- normal (>=12 weeks): full progression pattern.
- compressed (8-11 weeks): prioritize completion durability over aggressive speed gains.
- protective (4-7 weeks): keep quality minimal, emphasize safe long-run continuity.
- race-readiness (<4 weeks): no heavy build; include mostly taper/sharpening/recovery.

## Safety + structure rules
- No back-to-back hard run days.
- Keep week polarized: mostly easy aerobic running.
- Include at least one true recovery day ([] or ["Rest"]).
- Avoid doubles unless Experience is Advanced.
- Every run string MUST include a duration.
- Keep exactly 7 date keys and no extras.

## Week Layout Requirements (STRICT)
- You MUST return exactly these date keys and no others: ${weekDates.join(", ")}
- Long run should be clearly labeled as long run.
- Session wording should stay concise and parsable.

## Output format (REQUIRED)
Return ONLY valid JSON matching WeekJson schema:
{
  "label": string,
  "phase": string,
  "startDate": "YYYY-MM-DD",
  "deload": boolean,
  "days": { "YYYY-MM-DD": string[] }
}

Use style like:
- "🏃 Run — 45min easy (around 8:00–9:15${paceSuffix}) — Details"
- "🏃 Run — 55min tempo (15min warm-up, 20min @ tempo, 20min cool-down) — Details"
- "🏃 Long Run — 1h 50min steady (last 20min moderate) — Details"

Now generate the week so it satisfies ALL targets and rules.
`.trim();
}
