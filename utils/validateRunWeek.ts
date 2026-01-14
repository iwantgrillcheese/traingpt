// utils/validateRunWeek.ts
import type { UserParams, WeekJson, DayOfWeek } from "@/types/plan";
import { summarizeRunWeek, isRunSession, parseMinutesFromText, normalizeExperience, isHardRun } from "@/utils/runTargets";

const hasDuration = (s: string) =>
  /\b\d{1,3}\s*min(s)?\b/i.test(s) ||
  /\b\d+(?:\.\d+)?\s*(h|hr|hrs|hour|hours)\b/i.test(s) ||
  /\b\d{1,2}:\d{2}\b/.test(s);

const isoToDow = (dateISO: string): DayOfWeek => {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDay() as DayOfWeek;
};

export function validateRunWeek(args: {
  week: WeekJson;
  userParams: UserParams;
  weekMeta: { deload: boolean };
  targets: {
    targetWeeklyMin: number;
    longRunMax: number;
    qualityDays: number;
    preferredLongRunDay: DayOfWeek;
  };
  prevWeek?: WeekJson;
}) {
  const { week, userParams, weekMeta, targets, prevWeek } = args;
  const errors: string[] = [];
  const exp = normalizeExperience(userParams.experience);
  const allowDoubles = exp === "advanced";

  const curr = summarizeRunWeek(week);
  const prev = summarizeRunWeek(prevWeek);

  // 1) Ensure every run session includes a duration
  for (const [date, sessions] of Object.entries(week.days ?? {})) {
    for (const s of sessions ?? []) {
      if (!isRunSession(s)) continue;
      if (!hasDuration(s)) {
        errors.push(`Run session missing duration on ${date}: "${s}"`);
      }
    }
  }

  // 2) Weekly minutes band: only enforce if most run sessions are parseable
  // (prevents false fails if model still sneaks in distance-only strings)
  const parseableRatio =
    curr.totalRunSessions > 0 ? curr.parseableRunSessions / curr.totalRunSessions : 1;

  if (curr.totalMin > 0 && parseableRatio >= 0.8) {
    const minAllowed = Math.round(targets.targetWeeklyMin * 0.95);
    const maxAllowed = Math.round(targets.targetWeeklyMin * 1.05);
    if (curr.totalMin < minAllowed || curr.totalMin > maxAllowed) {
      errors.push(`Total run minutes ${curr.totalMin} outside target band ${minAllowed}-${maxAllowed}.`);
    }
  }

  // 3) Long run cap
  if (curr.longRunMin > 0 && curr.longRunMin > targets.longRunMax) {
    errors.push(`Long run ${curr.longRunMin} exceeds max ${targets.longRunMax}.`);
  }

  // 4) Hard day count + no back-to-back hard days
  if (curr.hardDays.length > targets.qualityDays) {
    errors.push(`Too many hard run days (${curr.hardDays.length}) > ${targets.qualityDays}.`);
  }

  const hardSorted = [...curr.hardDays].sort();
  for (let i = 1; i < hardSorted.length; i++) {
    const a = new Date(`${hardSorted[i - 1]}T00:00:00`).getTime();
    const b = new Date(`${hardSorted[i]}T00:00:00`).getTime();
    const diffDays = Math.round((b - a) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      errors.push(`Back-to-back hard run days: ${hardSorted[i - 1]} and ${hardSorted[i]}.`);
      break;
    }
  }

  // 5) No doubles unless Advanced (2+ run sessions in same day)
  for (const [date, sessions] of Object.entries(week.days ?? {})) {
    const runCount = (sessions ?? []).filter(isRunSession).length;
    if (runCount > 1 && !allowDoubles) {
      errors.push(`Multiple run sessions in one day (${runCount}) on ${date}. Doubles not allowed for ${userParams.experience}.`);
    }
  }

  // 6) Preferred long run day: longest run by duration must land on preferred DOW
  // Find the date(s) containing the max parsed duration.
  if (curr.longRunMin > 0) {
    const maxDates: string[] = [];
    for (const [date, sessions] of Object.entries(week.days ?? {})) {
      let dayMax = 0;
      for (const s of sessions ?? []) {
        if (!isRunSession(s)) continue;
        const m = parseMinutesFromText(s);
        if (m) dayMax = Math.max(dayMax, m);
      }
      if (dayMax === curr.longRunMin) maxDates.push(date);
    }

    const ok = maxDates.some((d) => isoToDow(d) === targets.preferredLongRunDay);
    if (!ok) {
      errors.push(
        `Longest run is not scheduled on preferred long run day (${targets.preferredLongRunDay}). Longest run dates: ${maxDates.join(", ")}`
      );
    }
  }

  // 7) Deload behavior: prefer volume reduction (if prev week parseable)
  if (weekMeta.deload && prev.totalMin > 0 && curr.totalMin > 0) {
    if (curr.totalMin > Math.round(prev.totalMin * 0.9)) {
      errors.push(`Deload week did not reduce volume enough: prev ${prev.totalMin}min → now ${curr.totalMin}min.`);
    }

    // Also limit hard work on deload: at most 1 hard day, and it should be short
    if (curr.hardDays.length > 1) {
      errors.push(`Deload week has too many hard days (${curr.hardDays.length}).`);
    }

    // Catch “full workout” intervals on deload by keyword + duration > ~40min
    for (const [date, sessions] of Object.entries(week.days ?? {})) {
      for (const s of sessions ?? []) {
        if (!isRunSession(s)) continue;
        if (!isHardRun(s)) continue;
        const mins = parseMinutesFromText(s);
        if (mins && mins > 40) {
          errors.push(`Deload week hard run too long on ${date}: ${mins}min ("${s}")`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      totalMin: curr.totalMin,
      longRunMin: curr.longRunMin,
      hardDays: curr.hardDays,
      parseableRatio,
    },
  };
}
