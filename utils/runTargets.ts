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
  return (
    s.includes("tempo") ||
    s.includes("threshold") ||
    s.includes("interval") ||
    s.includes("vo2") ||
    s.includes("hill") ||
    s.includes("race pace") ||
    s.includes("speed") ||
    /\b\d+\s*x\s*\d+\b/.test(s) ||
    /\b\d+x\d+\b/.test(s)
  );
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

function raceFamily(raceType?: string) {
  const s = String(raceType ?? "").toLowerCase();
  if (s.includes("marathon") || s.includes("26.2")) return "marathon" as const;
  if (s.includes("half") || s.includes("13.1")) return "half" as const;
  if (s.includes("10k")) return "10k" as const;
  if (s.includes("5k")) return "5k" as const;
  return "other" as const;
}

function weeksUntilRace(weekStartISO: string, raceISO?: string) {
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
  const race = raceFamily(userParams.raceType);
  const prev = summarizeRunWeek(prevWeek);
  const wtr = weeksUntilRace(weekMeta.startDate, userParams.raceDate);

  const maxHours = Number(userParams.maxHours || 0);
  const baseFromAvailability = Math.round(clamp(maxHours, 3, 14) * 60 * 0.78);
  const baseFromPrev = prev.totalMin > 0 ? prev.totalMin : baseFromAvailability;

  const deloadMult = weekMeta.deload ? 0.82 : 1;
  const phaseMult =
    weekMeta.phase === "Base" ? 1.0 :
    weekMeta.phase === "Build" ? 1.05 :
    weekMeta.phase === "Peak" ? 1.02 :
    0.72; // taper

  const rampPct = exp === "advanced" ? 0.08 : exp === "intermediate" ? 0.07 : 0.06;

  const weeklyCeilingByExp = {
    beginner: race === "marathon" ? 390 : 300,
    intermediate: race === "marathon" ? 520 : 420,
    advanced: race === "marathon" ? 650 : 520,
    unknown: race === "marathon" ? 480 : 360,
  } as const;

  const weeklyFloorByExp = {
    beginner: 130,
    intermediate: 180,
    advanced: 240,
    unknown: 160,
  } as const;

  const expKey = (exp in weeklyCeilingByExp ? exp : "unknown") as keyof typeof weeklyCeilingByExp;
  let targetWeeklyMin = Math.round(baseFromPrev * (weekMeta.deload ? 1 : 1 + rampPct) * phaseMult * deloadMult);
  targetWeeklyMin = clamp(targetWeeklyMin, weeklyFloorByExp[expKey], weeklyCeilingByExp[expKey]);

  // Marathon-specific long run progression, with short-cycle safety modes.
  const marathonPeakByExp = {
    beginner: 160,
    intermediate: 190,
    advanced: 220,
    unknown: 180,
  } as const;

  const genericPeakByExp = {
    beginner: 100,
    intermediate: 130,
    advanced: 160,
    unknown: 120,
  } as const;

  const peakLongRunMin = race === "marathon" ? marathonPeakByExp[expKey] : genericPeakByExp[expKey];

  let longPct = race === "marathon" ? 0.3 : 0.26;
  if (race === "marathon" && weekMeta.phase === "Build") longPct = 0.33;
  if (race === "marathon" && weekMeta.phase === "Peak") longPct = 0.35;

  if (wtr !== null && wtr <= 8 && wtr > 3) longPct = Math.max(longPct, race === "marathon" ? 0.34 : 0.28);
  if (wtr !== null && wtr <= 3) longPct = race === "marathon" ? 0.24 : 0.2;

  let targetLongRunMin = Math.round(targetWeeklyMin * longPct);

  // Marathon floors: meaningful long runs, but proportional in early weeks.
  let minLongRunMin = 0;
  if (race === "marathon" && !weekMeta.deload && weekMeta.phase !== "Taper") {
    const baseLoad = prev.totalMin > 0 ? prev.totalMin : targetWeeklyMin;
    const early = weekIndex <= 3;

    const earlyMinByExp = exp === "beginner" ? 75 : exp === "advanced" ? 95 : 85;
    const earlyMaxByExp = exp === "beginner" ? 95 : exp === "advanced" ? 125 : 110;

    const buildMinByExp = exp === "beginner" ? 95 : exp === "advanced" ? 125 : 110;
    const peakTargetByExp = exp === "beginner" ? 180 : exp === "advanced" ? 210 : 195; // ~20mi reachable

    if (early) {
      minLongRunMin = clamp(Math.round(baseLoad * 0.28), earlyMinByExp, earlyMaxByExp);
    } else {
      minLongRunMin = clamp(Math.round(baseLoad * 0.30), buildMinByExp, peakTargetByExp);
      if (wtr !== null && wtr <= 6 && wtr > 2) {
        const lateBuildFloor = exp === "beginner" ? 120 : exp === "advanced" ? 155 : 140;
        minLongRunMin = Math.max(minLongRunMin, lateBuildFloor);
      }
    }
  }

  if (minLongRunMin > 0) {
    targetLongRunMin = Math.max(targetLongRunMin, minLongRunMin);
  }

  // Keep long run proportionate to weekly load (phase-aware caps).
  if (race === "marathon") {
    const maxPct =
      weekMeta.phase === "Peak"
        ? exp === "beginner"
          ? 0.40
          : exp === "advanced"
            ? 0.43
            : 0.41
        : exp === "beginner"
          ? 0.33
          : exp === "advanced"
            ? 0.37
            : 0.35;
    targetLongRunMin = Math.min(targetLongRunMin, Math.round(targetWeeklyMin * maxPct));
  }

  // Progression cap from previous long run (smoother early build, explicit deload reduction).
  const prevLong = prev.longRunMin || 0;
  const isEarlyBlock = weekIndex <= 3;
  const maxStep = weekMeta.deload ? 0 : race === "marathon" ? (isEarlyBlock ? 10 : 15) : 12;
  const longRunProgressionCap =
    prevLong > 0 ? Math.max(prevLong + maxStep, minLongRunMin || 0) : peakLongRunMin;

  // Single-run absolute cap for safety.
  const maxSingleRunMin =
    exp === "beginner" ? (race === "marathon" ? 165 : 110) :
    exp === "advanced" ? (race === "marathon" ? 230 : 170) :
    (race === "marathon" ? 200 : 140);

  // Taper / deload reductions
  if (weekMeta.phase === "Taper") {
    const taperMult = wtr !== null && wtr <= 1 ? 0.45 : 0.62;
    targetLongRunMin = Math.round(targetLongRunMin * taperMult);
    minLongRunMin = 0;
  }

  if (weekMeta.deload && prevLong > 0) {
    targetLongRunMin = Math.min(targetLongRunMin, Math.max(45, Math.round(prevLong * 0.88)));
    minLongRunMin = 0;
  }

  targetLongRunMin = clamp(targetLongRunMin, 45, peakLongRunMin);
  const longRunMax = clamp(Math.min(targetLongRunMin, longRunProgressionCap), 45, maxSingleRunMin);

  const qualityDays =
    weekMeta.phase === "Base" ? 1 :
    weekMeta.phase === "Build" ? (exp === "beginner" ? 1 : 2) :
    weekMeta.phase === "Peak" ? (exp === "beginner" ? 1 : 2) :
    1;

  const maxQualityMin =
    weekMeta.phase === "Base" ? 25 :
    weekMeta.phase === "Build" ? 50 :
    weekMeta.phase === "Peak" ? 55 :
    20;

  return {
    targetWeeklyMin,
    targetLongRunMin,
    minLongRunMin,
    longRunMax,
    maxSingleRunMin,
    qualityDays,
    maxQualityMin,
    prevWeeklyMin: prev.totalMin || 0,
    prevLongRunMin: prev.longRunMin || 0,
    experienceNorm: exp,
    raceFamily: race,
    weeksToRace: wtr,
  };
}
