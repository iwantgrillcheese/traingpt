// utils/runTargets.ts
import type { UserParams, WeekMeta, WeekJson } from "@/types/plan";

/** Parse duration from your current string conventions */
export function parseMinutesFromText(text: string): number | null {
  const s = text.toLowerCase().trim();

  const minMatch = s.match(/\b(\d{1,3})\s*min(s)?\b/);
  if (minMatch) return Number(minMatch[1]);

  const hrMatch = s.match(/\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  if (hrMatch) return Math.round(Number(hrMatch[1]) * 60);

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
  if (s.includes("tempo")) return true;
  if (s.includes("threshold")) return true;
  if (s.includes("interval")) return true;
  if (s.includes("vo2")) return true;
  if (s.includes("hill")) return true;
  if (s.includes("race pace")) return true;
  if (s.includes("speed")) return true;

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

function isTrueBeginner(exp: ReturnType<typeof normalizeExperience>, prev: ReturnType<typeof summarizeRunWeek>) {
  if (exp === "advanced") return false;
  if (exp === "intermediate") return prev.totalMin < 120;
  return prev.totalMin < 150;
}

function isMarathon(raceType?: string) {
  const s = String(raceType ?? "").toLowerCase();
  // be forgiving: "marathon", "26.2", etc.
  return s.includes("marathon") || s.includes("26.2");
}

function weeksUntilRace(weekStartISO: string, raceISO?: string) {
  // returns whole weeks from week start to race date (floor)
  if (!raceISO) return null;
  const a = new Date(`${weekStartISO}T00:00:00`).getTime();
  const b = new Date(`${raceISO}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diffDays = Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
  return Math.floor(diffDays / 7);
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

  const marathon = isMarathon(userParams.raceType);
  const wtr = weeksUntilRace(weekMeta.startDate, userParams.raceDate); // can be null

  const trueBeginner = isTrueBeginner(exp, prev);
  const inRamp = trueBeginner && weekIndex <= 2; // Weeks 1–3

  const baseWeeklyFromPrev = prev.totalMin > 0 ? prev.totalMin : 0;

  // Conservative fallback baselines (when no prev week)
  const fallbackWeeklyMin =
    exp === "advanced"
      ? Math.max(240, Math.round((maxHours || 6) * 50))
      : exp === "intermediate"
        ? Math.max(180, Math.round((maxHours || 5) * 45))
        : Math.max(120, Math.round((maxHours || 4) * 35));

  // Explicit beginner ramp if no prior data
  const rampWeeklyTargets = [140, 155, 170]; // week1..week3
  const rampLongTargets = [45, 50, 55]; // week1..week3

  const baseWeeklyMin = baseWeeklyFromPrev > 0 ? baseWeeklyFromPrev : fallbackWeeklyMin;

  // Ramp rate (post-ramp)
  const rampPct = exp === "beginner" ? 0.06 : exp === "advanced" ? 0.09 : 0.075;

  // Deload reduces volume
  const deloadMult = weekMeta.deload ? 0.80 : 1.0;

  // Phase behavior
  const phaseMult =
    weekMeta.phase === "Base" ? 1.0 :
    weekMeta.phase === "Build" ? 1.04 :
    weekMeta.phase === "Peak" ? 1.02 :
    weekMeta.phase === "Taper" ? 0.70 :
    1.0;

  // Marathon-aware ceilings (THIS IS THE BIG FIX)
  const peakWeeklyMin =
    !marathon
      ? (exp === "advanced" ? 500 : exp === "intermediate" ? 380 : 260)
      : (exp === "advanced" ? 560 : exp === "intermediate" ? 440 : 340);

  const weeklyMinFloor =
    exp === "advanced" ? 240 :
    exp === "intermediate" ? 160 :
    120;

  let targetWeeklyMin: number;

  if (inRamp && baseWeeklyFromPrev === 0) {
    targetWeeklyMin = rampWeeklyTargets[weekIndex] ?? rampWeeklyTargets[rampWeeklyTargets.length - 1];
  } else {
    const progressed = Math.round(baseWeeklyMin * (1 + (weekMeta.deload ? 0 : rampPct)));
    const additive = (weekMeta.phase === "Base" || weekMeta.phase === "Build") ? weekIndex * 4 : 0;
    targetWeeklyMin = Math.round((progressed + additive) * phaseMult * deloadMult);
  }

  targetWeeklyMin = clamp(targetWeeklyMin, weeklyMinFloor, peakWeeklyMin);

  // Long run peak target (time-on-feet)
  const peakLongRunMin =
    !marathon
      ? (exp === "advanced" ? 150 : exp === "intermediate" ? 120 : 90)
      : (exp === "advanced" ? 200 : exp === "intermediate" ? 180 : 160);

  // Long run fraction (marathon plans should not be stuck at 25%)
  // Let it float higher in Build/Peak.
  const longPct =
    !marathon
      ? (exp === "beginner" ? 0.25 : exp === "advanced" ? 0.33 : 0.30)
      : (weekMeta.phase === "Peak" ? 0.34 : weekMeta.phase === "Build" ? 0.32 : 0.28);

  let targetLongRunMin: number;

  if (inRamp && baseWeeklyFromPrev === 0) {
    targetLongRunMin = rampLongTargets[weekIndex] ?? rampLongTargets[rampLongTargets.length - 1];
  } else {
    // Primary target based on weekly minutes
    targetLongRunMin = Math.round(targetWeeklyMin * longPct);
  }

  // Taper behavior: pull long run down as race approaches
  if (marathon && weekMeta.phase === "Taper") {
    // If we know weeks-to-race, taper more aggressively near race week
    const taperMult = wtr !== null && wtr <= 1 ? 0.45 : 0.60;
    targetLongRunMin = Math.round(targetLongRunMin * taperMult);
  }

  // Absolute caps early (prevents “too much too soon”)
  const absLongCap =
    trueBeginner ? (inRamp ? 60 : 95) :
    exp === "intermediate" ? (weekIndex <= 1 ? 95 : 140) :
    180;

  targetLongRunMin = Math.min(targetLongRunMin, peakLongRunMin, absLongCap);

  // Quality caps
  const qualityDays =
    weekMeta.phase === "Base" ? 1 :
    weekMeta.phase === "Build" ? 2 :
    weekMeta.phase === "Peak" ? 2 :
    1;

  const maxQualityMin =
    weekMeta.phase === "Base" ? 25 :
    weekMeta.phase === "Build" ? 45 :
    weekMeta.phase === "Peak" ? 55 :
    20;

  const effectiveQualityDays = inRamp ? 1 : qualityDays;
  const effectiveMaxQualityMin = inRamp ? Math.min(maxQualityMin, 20) : maxQualityMin;

  // Long run max cap: allow growth vs prev long run, but keep it controlled
  const prevLong = prev.longRunMin || 0;

  const stepUp =
    inRamp ? 5 :
    weekMeta.phase === "Base" ? 8 :
    weekMeta.phase === "Build" ? 12 :
    weekMeta.phase === "Peak" ? 10 :
    8;

  const growthCap = prevLong > 0 ? prevLong + stepUp : absLongCap;

  const longRunMax =
    prevLong > 0
      ? Math.min(Math.max(targetLongRunMin, prevLong), growthCap, peakLongRunMin)
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
