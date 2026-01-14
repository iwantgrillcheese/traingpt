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

  // Baseline weekly minutes:
  // - Use previous week if we had parseable durations
  // - Else use maxHours proxy (running plan => most of maxHours is running)
  const baseWeeklyMin =
    prev.totalMin > 0 ? prev.totalMin : Math.max(180, Math.round((maxHours || 4) * 60));

  // Ramp rate
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

  // Progression from base (no ramp on deload)
  const progressed = Math.round(baseWeeklyMin * (1 + (weekMeta.deload ? 0 : rampPct)));

  // Small additive ramp in Base/Build (helps if prev week was unparseable)
  const additive = (weekMeta.phase === "Base" || weekMeta.phase === "Build") ? weekIndex * 3 : 0;

  const targetWeeklyMin = Math.round((progressed + additive) * phaseMult * deloadMult);

  // Long run fraction
  const longPct = exp === "beginner" ? 0.25 : exp === "advanced" ? 0.33 : 0.30;
  const targetLongRunMin = Math.round(targetWeeklyMin * longPct);

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

  // Long run max cap (prevent spikes vs prev long run if known)
  const prevLong = prev.longRunMin || 0;
  const longRunMax = prevLong > 0 ? Math.round(Math.max(targetLongRunMin, prevLong * 1.08)) : targetLongRunMin;

  return {
    targetWeeklyMin,
    targetLongRunMin,
    longRunMax,
    qualityDays,
    maxQualityMin,
    prevWeeklyMin: prev.totalMin || 0,
    prevLongRunMin: prev.longRunMin || 0,
    experienceNorm: exp,
  };
}
