import type { UserParams, WeekJson, DayOfWeek } from "@/types/plan";
import { summarizeRunWeek, isRunSession, parseMinutesFromText, normalizeExperience, isHardRun } from "@/utils/runTargets";

const hasDuration = (s: string) => {
  const m = parseMinutesFromText(s);
  return Number.isFinite(m ?? NaN) && (m ?? 0) > 0;
};

const isoToDow = (dateISO: string): DayOfWeek => new Date(`${dateISO}T00:00:00`).getDay() as DayOfWeek;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const bucket5 = (m: number) => Math.round(m / 5) * 5;

export function validateRunWeek(args: {
  week: WeekJson;
  userParams: UserParams;
  weekMeta: { deload: boolean; phase?: string };
  targets: {
    targetWeeklyMin: number;
    longRunMax: number;
    qualityDays: number;
    preferredLongRunDay: DayOfWeek;
    targetLongRunMin?: number;
    minLongRunMin?: number;
    maxQualityMin?: number;
    maxSingleRunMin?: number;
    raceFamily?: string;
  };
  prevWeek?: WeekJson;
}) {
  const { week, userParams, weekMeta, targets, prevWeek } = args;
  const errors: string[] = [];

  const exp = normalizeExperience(userParams.experience);
  const allowDoubles = exp === "advanced";

  const curr = summarizeRunWeek(week);
  const prev = summarizeRunWeek(prevWeek);
  const parseableRatio = curr.totalRunSessions > 0 ? curr.parseableRunSessions / curr.totalRunSessions : 1;

  const perDayMinutes: Array<{ date: string; min: number; hard: boolean }> = [];
  const runDurations: number[] = [];
  let hardMinTotal = 0;

  for (const [date, sessions] of Object.entries(week.days ?? {})) {
    let dayMin = 0;
    let dayHard = false;
    let runCount = 0;

    for (const s of sessions ?? []) {
      if (!isRunSession(s)) continue;
      runCount += 1;
      if (!hasDuration(s)) errors.push(`Run session missing duration on ${date}: "${s}"`);
      const m = parseMinutesFromText(s);
      if (m) {
        dayMin += m;
        runDurations.push(m);
        if (isHardRun(s)) hardMinTotal += m;
      }
      if (isHardRun(s)) dayHard = true;
    }

    if (runCount > 1 && !allowDoubles) {
      errors.push(`Multiple run sessions in one day (${runCount}) on ${date}. Doubles not allowed for ${userParams.experience}.`);
    }

    perDayMinutes.push({ date, min: dayMin, hard: dayHard });
  }

  // Weekly minute band
  if (curr.totalMin > 0 && parseableRatio >= 0.8) {
    const minAllowed = Math.round(targets.targetWeeklyMin * 0.95);
    const maxAllowed = Math.round(targets.targetWeeklyMin * 1.05);
    if (curr.totalMin < minAllowed || curr.totalMin > maxAllowed) {
      errors.push(`Total run minutes ${curr.totalMin} outside target band ${minAllowed}-${maxAllowed}.`);
    }
  }

  // Long run checks
  if (curr.longRunMin > 0 && curr.longRunMin > targets.longRunMax) {
    errors.push(`Long run ${curr.longRunMin} exceeds max ${targets.longRunMax}.`);
  }
  if (typeof targets.targetLongRunMin === "number" && targets.targetLongRunMin > 0 && curr.longRunMin > 0) {
    const tol = Math.max(8, Math.round(targets.targetLongRunMin * 0.12));
    const minLR = clamp(targets.targetLongRunMin - tol, 0, targets.longRunMax);
    const maxLR = clamp(targets.targetLongRunMin + tol, 0, targets.longRunMax);
    if (curr.longRunMin < minLR || curr.longRunMin > maxLR) {
      errors.push(`Long run ${curr.longRunMin} not within target tolerance (${minLR}-${maxLR}) for target ${targets.targetLongRunMin}.`);
    }
  }
  if (typeof targets.minLongRunMin === "number" && targets.minLongRunMin > 0 && !weekMeta.deload && curr.longRunMin > 0 && curr.longRunMin < targets.minLongRunMin) {
    errors.push(`Long run ${curr.longRunMin} below minimum floor ${targets.minLongRunMin}.`);
  }

  // Long run <=35% weekly minutes
  if (curr.totalMin > 0 && curr.longRunMin > Math.round(curr.totalMin * 0.35)) {
    errors.push(`Long run ${curr.longRunMin} exceeds 35% of weekly minutes (${curr.totalMin}).`);
  }

  // hard days rules + no back-to-back + must be followed by easy day
  if (curr.hardDays.length > targets.qualityDays) {
    errors.push(`Too many hard run days (${curr.hardDays.length}) > ${targets.qualityDays}.`);
  }

  const daySorted = [...perDayMinutes].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < daySorted.length; i++) {
    if (daySorted[i - 1].hard && daySorted[i].hard) {
      errors.push(`Back-to-back hard run days: ${daySorted[i - 1].date} and ${daySorted[i].date}.`);
      break;
    }
  }
  for (let i = 0; i < daySorted.length - 1; i++) {
    if (!daySorted[i].hard) continue;
    const next = daySorted[i + 1];
    if (next.hard || next.min >= 60) {
      errors.push(`Quality day ${daySorted[i].date} must be followed by easier day; got ${next.date} (${next.min}min).`);
    }
  }

  if (typeof targets.maxQualityMin === "number" && targets.maxQualityMin > 0 && parseableRatio >= 0.8 && hardMinTotal > targets.maxQualityMin) {
    errors.push(`Total hard-run minutes ${hardMinTotal} exceeds maxQualityMin ${targets.maxQualityMin}.`);
  }

  if (typeof targets.maxSingleRunMin === "number" && targets.maxSingleRunMin > 0) {
    for (const [date, sessions] of Object.entries(week.days ?? {})) {
      for (const s of sessions ?? []) {
        if (!isRunSession(s)) continue;
        const m = parseMinutesFromText(s);
        if (m && m > targets.maxSingleRunMin) {
          errors.push(`Run duration ${m}min exceeds maxSingleRunMin ${targets.maxSingleRunMin} on ${date}: "${s}"`);
        }
      }
    }
  }

  // preferred long-run day
  if (curr.longRunMin > 0) {
    const maxDates = perDayMinutes.filter((d) => d.min === curr.longRunMin).map((d) => d.date);
    const ok = maxDates.some((d) => isoToDow(d) === targets.preferredLongRunDay);
    if (!ok) errors.push(`Longest run is not scheduled on preferred long run day (${targets.preferredLongRunDay}). Longest run dates: ${maxDates.join(", ")}`);
  }

  // Structure gates
  const raceFam = String(targets.raceFamily ?? "").toLowerCase();
  const trueBeginner = exp === "beginner" && (prev.totalMin || 0) < 150;
  const mediumLongCount = runDurations.filter((m) => m >= 55 && m < curr.longRunMin).length;
  const shortEasyCount = runDurations.filter((m) => m >= 30 && m <= 55).length;
  const hasStrides = Object.values(week.days ?? {}).flat().some((s) => /stride/i.test(String(s)));

  if (curr.longRunMin <= 0) errors.push('Missing long run in week.');
  if (targets.qualityDays >= 1 && curr.hardDays.length < 1) errors.push('Missing required quality workout.');
  if (!trueBeginner && raceFam === 'marathon' && mediumLongCount < 1) errors.push('Missing medium-long aerobic run (55-80min).');
  if (shortEasyCount < (trueBeginner ? 2 : 2) || shortEasyCount > (trueBeginner ? 4 : 3)) {
    errors.push(`Short easy runs count out of range (${shortEasyCount}); expected ${trueBeginner ? '2-4' : '2-3'}.`);
  }
  if (!hasStrides) errors.push('At least one easy run must include strides (e.g., 6x20s).');

  // Monotony guards
  const over70 = runDurations.filter((m) => m >= 70).length;
  const advancedPeakException =
    String(weekMeta.phase ?? "").toLowerCase() === "peak" && exp === "advanced" && (prev.totalMin || 0) >= 320;
  if (over70 > 2 && !advancedPeakException) {
    errors.push(`Too many long sessions >=70min (${over70}).`);
  }

  let consecutive60 = 0;
  let maxConsecutive60 = 0;
  for (const d of daySorted) {
    if (d.min >= 60) consecutive60 += 1;
    else consecutive60 = 0;
    maxConsecutive60 = Math.max(maxConsecutive60, consecutive60);
  }
  if (maxConsecutive60 > 2) errors.push(`More than 2 consecutive run days >=60min (max streak ${maxConsecutive60}).`);

  const bucketCounts = new Map<number, number>();
  for (const m of runDurations) {
    const b = bucket5(m);
    bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
  }
  for (const [bucket, count] of bucketCounts.entries()) {
    if (count > 2) errors.push(`Duration bucket ${bucket}min repeated ${count} times (>2).`);
  }

  // Deload reduction
  if (weekMeta.deload && prev.totalMin > 0 && curr.totalMin > Math.round(prev.totalMin * 0.9)) {
    errors.push(`Deload week did not reduce volume enough: prev ${prev.totalMin}min → now ${curr.totalMin}min.`);
  }
  if (weekMeta.deload && prev.longRunMin > 0 && curr.longRunMin >= prev.longRunMin) {
    errors.push(`Deload week long run did not reduce: prev ${prev.longRunMin}min → now ${curr.longRunMin}min.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      totalMin: curr.totalMin,
      longRunMin: curr.longRunMin,
      hardDays: curr.hardDays,
      parseableRatio,
      over70,
      maxConsecutive60,
      bucketCounts: Object.fromEntries(bucketCounts.entries()),
    },
  };
}
