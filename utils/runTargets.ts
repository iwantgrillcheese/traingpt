// utils/runTargets.ts
import type { UserParams, WeekMeta, WeekJson } from "@/types/plan";

/** Parse duration from your current string conventions */
export function parseMinutesFromText(text: string): number | null {
  const s = text.toLowerCase().trim();

  // 90min, 90 min, 90mins
  const minMatch = s.match(/\b(\d{1,3})\s*min(s)?\b/);
  if (minMatch) return Number(minMatch[1]);

  // 2hr, 2 hr, 2hours, 2 hours, 1.5h
  const hrMatch = s.match(/\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  if (hrMatch) return Math.round(Number(hrMatch[1]) * 60);

  // 1:30 (h:mm)
  const hmMatch = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hmMatch) {
    const h = Number(hmMatch[1]);
    const m = Number(hmMatch[2]);
    if (h <= 6 && m < 60) return h * 60 + m;
  }

  return null;
}

export function isRunSession(text: string): boolean {
  const s = text.toLowerCase();
  return s.includes("🏃") || s.includes(" run") || s.startsWith("run");
}

export function isHardRun(text: string): boolean {
  const s = text.toLowerCase();

  // Explicit quality keywords
  if (s.includes("tempo")) return true;
  if (s.includes("threshold")) return true;
  if (s.includes("interval")) return true;
  if (s.includes("vo2")) return true;
  if (s.includes("hill")) return true;
  if (s.includes("race pace")) return true;
  if (s.includes("speed")) return true;

  // Rep patterns: 5x800, 8x400m, 5 x 800m, etc.
  if (s.match(/\b\d+\s*x\s*\d+\b/)) return true;
  if (s.match(/\b\d+x\d+\b/)) return true;
  if (s.match(/\b\d+\s*x\s*\d+\s*m\b/)) return true;

  return false;
}

export function summarizeRunWeek(week?: WeekJson) {
  if (!week) {
    return {
      totalMin: 0,
      longRunMin: 0,
      hardDays: [] as string[],
      runDays: [] as string[],
      parseableRunSessions: 0,
      totalRunSessions: 0,
    };
  }

  let totalMin = 0;
  let longRunMin = 0;
  let parseableRunSessions = 0;
  let totalRunSessions = 0;

  const hardDays: string[] = [];
  const runDays: string[] = [];

  for (const [date, sessions] of Object.entries(week.days ?? {})) {
    let hasRun = false;
    let dayHard = false;

    for (const sess of sessions ?? []) {
      if (!isRunSession(sess)) continue;
      hasRun = true;
      totalRunSessions += 1;

      const mins = parseMinutesFromText(sess);
      if (mins) {
        parseableRunSessions += 1;
        totalMin += mins;
        longRunMin = Math.max(longRunMin, mins);
      }

      if (isHardRun(sess)) dayHard = true;
    }

    if (hasRun) runDays.push(date);
    if (dayHard) hardDays.push(date);
  }

  return { totalMin, longRunMin, hardDays, runDays, parseableRunSessions, totalRunSessions };
}

export function normalizeExperience(exp: string | undefined) {
  const s = String(exp ?? "").toLowerCase();
  if (s.includes("beginner")) return "beginner" as const;
  if (s.includes("advanced")) return "advanced" as const;
  if (s.includes("intermediate")) return "intermediate" as const;
  return "unknown" as const;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * True-beginner heuristic:
 * If user is Beginner (or Unknown) AND we don't have a meaningful prior-week volume,
 * treat them as "true beginner" and ramp for weeks 1–3.
 */
function isTrueBeginner(exp: ReturnType<typeof normalizeExperience>, prev: ReturnType<typeof summarizeRunWeek>) {
  if (exp === "advanced") return false;
  if (exp === "intermediate") return prev.totalMin < 120;
  // beginner or unknown
  return prev.totalMin < 150;
}

export function computeRunTargets(args: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  weekIndex: number;
  prevWeek?: WeekJson;
}) {
  const { userParams, weekMeta, weekIndex, prevWeek } = args;
  const exp = normalizeExperience(userParams.experience);

  const prev = summarizeRunWeek(prevWeek);
  const maxHours = Number(userParams.maxHours || 0);

  const trueBeginner = isTrueBeginner(exp, prev);
  const inRamp = trueBeginner && weekIndex <= 2; // Weeks 1–3

  /**
   * Baseline weekly minutes:
   * - If we have prior parseable volume, use it.
   * - If not, DO NOT assume maxHours == run hours for week 1.
   *   That's what was generating hour-long runs immediately.
   */
  const baseWeeklyFromPrev = prev.totalMin > 0 ? prev.totalMin : 0;

  // Conservative fallback baselines (when no prev week)
  const fallbackWeeklyMin =
    exp === "advanced" ? Math.max(240, Math.round((maxHours || 6) * 50)) :
    exp === "intermediate" ? Math.max(180, Math.round((maxHours || 5) * 45)) :
    // beginner/unknown fallback should be modest
    Math.max(120, Math.round((maxHours || 4) * 35));

  // If true beginner and no prior volume, force an explicit ramp baseline
  const rampWeeklyTargets = [140, 155, 170]; // week1..week3 targets
  const rampLongTargets = [45, 50, 55];      // week1..week3 long run targets

  const baseWeeklyMin = baseWeeklyFromPrev > 0 ? baseWeeklyFromPrev : fallbackWeeklyMin;

  // Ramp rate (for post-ramp and for those with an existing base)
  const rampPct = exp === "beginner" ? 0.05 : exp === "advanced" ? 0.08 : 0.06;

  // Phase behavior (light)
  const phaseMult =
    weekMeta.phase === "Base" ? 1.0 :
    weekMeta.phase === "Build" ? 1.02 :
    weekMeta.phase === "Peak" ? 0.98 :
    weekMeta.phase === "Taper" ? 0.70 :
    1.0;

  // Deload reduces volume
  const deloadMult = weekMeta.deload ? 0.80 : 1.0;

  let targetWeeklyMin: number;

  if (inRamp && baseWeeklyFromPrev === 0) {
    // True beginner + no prior data: explicit ramp weeks override everything
    targetWeeklyMin = rampWeeklyTargets[weekIndex] ?? rampWeeklyTargets[rampWeeklyTargets.length - 1];
  } else {
    // Progression from base (no ramp on deload)
    const progressed = Math.round(baseWeeklyMin * (1 + (weekMeta.deload ? 0 : rampPct)));

    // Small additive ramp in Base/Build (helps if prev week was unparseable)
    const additive = (weekMeta.phase === "Base" || weekMeta.phase === "Build") ? weekIndex * 3 : 0;

    targetWeeklyMin = Math.round((progressed + additive) * phaseMult * deloadMult);
  }

  // Global sanity clamp by experience (prevents crazy spikes)
  const weeklyMinCap =
    exp === "advanced" ? 500 :
    exp === "intermediate" ? 380 :
    260;

  const weeklyMinFloor =
    exp === "advanced" ? 240 :
    exp === "intermediate" ? 160 :
    120;

  targetWeeklyMin = clamp(targetWeeklyMin, weeklyMinFloor, weeklyMinCap);

  // Long run fraction
  const longPct = exp === "beginner" ? 0.25 : exp === "advanced" ? 0.33 : 0.30;

  let targetLongRunMin: number;

  if (inRamp && baseWeeklyFromPrev === 0) {
    targetLongRunMin = rampLongTargets[weekIndex] ?? rampLongTargets[rampLongTargets.length - 1];
  } else {
    targetLongRunMin = Math.round(targetWeeklyMin * longPct);
  }

  // Absolute caps early (this is the “no 60min day-one” guarantee)
  const absLongCap =
    trueBeginner ? (inRamp ? 60 : 85) :
    exp === "intermediate" ? (weekIndex <= 1 ? 90 : 120) :
    150;

  targetLongRunMin = Math.min(targetLongRunMin, absLongCap);

  // Quality caps
  const qualityDays =
    weekMeta.phase === "Base" ? 1 :
    weekMeta.phase === "Build" ? 2 :
    weekMeta.phase === "Peak" ? 2 :
    1;

  const maxQualityMin =
    weekMeta.phase === "Base" ? 25 :
    weekMeta.phase === "Build" ? 40 :
    weekMeta.phase === "Peak" ? 45 :
    20;

  // Tighten quality for true beginners in ramp
  const effectiveQualityDays = inRamp ? 1 : qualityDays;
  const effectiveMaxQualityMin = inRamp ? Math.min(maxQualityMin, 20) : maxQualityMin;

  /**
   * Long run max cap (prevent spikes vs prev long run if known)
   * BUG FIX: previously used Math.max(...), which makes the "cap" bigger than target.
   * Correct behavior is to cap at min(target, prevLong * allowedGrowth) if prev is known.
   */
  const prevLong = prev.longRunMin || 0;

  const growthCap = prevLong > 0 ? Math.round(prevLong * 1.08) : absLongCap;
  const longRunMax = prevLong > 0
    ? Math.min(Math.max(targetLongRunMin, prevLong), growthCap) // allow modest growth but cap it
    : targetLongRunMin;

  return {
    targetWeeklyMin,
    targetLongRunMin,
    longRunMax,
    qualityDays: effectiveQualityDays,
    maxQualityMin: effectiveMaxQualityMin,
    prevWeeklyMin: prev.totalMin || 0,
    prevLongRunMin: prev.longRunMin || 0,
    experienceNorm: exp,
  };
}
