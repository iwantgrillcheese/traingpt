import { addDays, formatISO, isValid, parseISO } from 'date-fns';
import type { GeneratedPlan, UserParams, WeekJson } from '@/types/plan';

export type PlanValidationResult = {
  ok: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  stats: {
    expectedWeeks: number;
    actualWeeks: number;
    totalSessions: number;
    emptyWeeks: number;
  };
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isoDate(date: Date) {
  return formatISO(date, { representation: 'date' });
}

function normalizeDayName(value?: string | null) {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  const match = DAY_NAMES.find((day) => day.toLowerCase() === cleaned);
  return match ?? null;
}

function dayNameFromISO(dateISO: string) {
  const parsed = parseISO(dateISO);
  if (!isValid(parsed)) return null;
  return DAY_NAMES[parsed.getDay()] ?? null;
}

function canonicalWeekDates(startDateISO: string) {
  const start = parseISO(startDateISO);
  if (!isValid(start)) return [];
  return Array.from({ length: 7 }, (_, index) => isoDate(addDays(start, index)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeDays(week: WeekJson): Record<string, unknown[]> {
  if (!isRecord(week?.days)) return {};
  return Object.fromEntries(
    Object.entries(week.days).map(([date, items]) => [date, Array.isArray(items) ? items : []])
  );
}

function itemText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (isRecord(item)) {
    const title = typeof item.title === 'string' ? item.title : '';
    const details = typeof item.details === 'string' ? item.details : '';
    const sport = typeof item.sport === 'string' ? item.sport : '';
    return [sport, title, details].filter(Boolean).join(' ');
  }
  return '';
}

function isTrainingSession(item: unknown): boolean {
  const text = itemText(item).toLowerCase();
  if (!text.trim()) return false;
  if (/race day|\brace\b/.test(text)) return true;
  if (/\b(rest|day off|off day|complete rest)\b/.test(text)) return false;
  if (/\brecovery\b/.test(text) && !/swim|bike|ride|run|strength|gym/.test(text)) return false;
  return true;
}

function hasSport(item: unknown, sport: 'swim' | 'bike' | 'run' | 'strength' | 'brick') {
  const text = itemText(item).toLowerCase();
  if (sport === 'bike') return /\b(bike|ride|cycling|ftp)\b/.test(text);
  if (sport === 'run') return /\b(run|running|jog|tempo|threshold|interval)\b/.test(text);
  if (sport === 'swim') return /\b(swim|css|pool|open water)\b/.test(text);
  if (sport === 'strength') return /\b(strength|gym|core|mobility)\b/.test(text);
  if (sport === 'brick') return /\bbrick\b/.test(text);
  return false;
}

function parseDurationMinutes(text: string): number | null {
  const lower = text.toLowerCase();
  const hourMinMatch = lower.match(/(\d+(?:\.\d+)?)\s*h(?:ou?r)?s?\s*(\d+)?\s*m?/i);
  if (hourMinMatch) {
    const hours = Number(hourMinMatch[1]);
    const mins = hourMinMatch[2] ? Number(hourMinMatch[2]) : 0;
    if (Number.isFinite(hours) && Number.isFinite(mins)) return Math.round(hours * 60 + mins);
  }

  const minMatch = lower.match(/(\d+)\s*(?:min|mins|minutes|m)\b/i);
  if (minMatch) {
    const mins = Number(minMatch[1]);
    if (Number.isFinite(mins)) return mins;
  }

  return null;
}

function looksLikeLongRide(item: unknown) {
  const text = itemText(item).toLowerCase();
  const minutes = parseDurationMinutes(text);
  return hasSport(item, 'bike') && (/\blong\b/.test(text) || (minutes !== null && minutes >= 90));
}

function looksLikeLongRun(item: unknown) {
  const text = itemText(item).toLowerCase();
  const minutes = parseDurationMinutes(text);
  return hasSport(item, 'run') && (/\blong\b/.test(text) || (minutes !== null && minutes >= 60));
}

function hasLeadingTitleJunk(item: unknown) {
  const text = itemText(item).trim();
  return /^[\s—–\-:•*]+/.test(text);
}

function isRaceWeek(week: WeekJson, raceDate?: string) {
  if (!raceDate) return false;
  return canonicalWeekDates(week.startDate).includes(raceDate);
}

export function validateGeneratedPlan({
  plan,
  expectedWeeks,
  userParams,
}: {
  plan: GeneratedPlan;
  expectedWeeks?: number;
  userParams: UserParams;
}): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const expected = expectedWeeks ?? weeks.length;
  let totalSessions = 0;
  let emptyWeeks = 0;

  if (!Array.isArray(plan?.weeks)) {
    errors.push('Plan is missing a weeks array.');
  }

  if (expected && weeks.length !== expected) {
    errors.push(`Expected ${expected} weeks, received ${weeks.length}.`);
  }

  const restDay = normalizeDayName(userParams.restDay);
  const unavailableDays = new Set((userParams.unavailableDays ?? []).map(normalizeDayName).filter(Boolean));
  const preferredLongRideDay = normalizeDayName(userParams.preferredLongRideDay);
  const preferredLongRunDay = normalizeDayName(userParams.preferredLongRunDay);
  const twoADaysAllowed = userParams.twoADaysAllowed !== false;

  weeks.forEach((week, weekIndex) => {
    const label = week?.label || `Week ${weekIndex + 1}`;
    const canonicalDates = canonicalWeekDates(week?.startDate ?? '');

    if (!week || typeof week !== 'object') {
      errors.push(`${label} is not a valid week object.`);
      return;
    }

    if (canonicalDates.length !== 7) {
      errors.push(`${label} has an invalid startDate (${week?.startDate ?? 'missing'}).`);
      return;
    }

    const days = safeDays(week);
    if (!isRecord(week.days)) {
      errors.push(`${label} is missing a valid days object.`);
      return;
    }

    const allTrainingItems: Array<{ date: string; item: unknown }> = [];
    let weekSessionCount = 0;

    for (const date of canonicalDates) {
      const items = Array.isArray(days[date]) ? days[date] : [];
      const trainingItems = items.filter(isTrainingSession);
      weekSessionCount += trainingItems.length;
      totalSessions += trainingItems.length;
      trainingItems.forEach((item) => allTrainingItems.push({ date, item }));

      const dayName = dayNameFromISO(date);
      if (dayName && unavailableDays.has(dayName) && trainingItems.length > 0) {
        warnings.push(`${label}: training scheduled on unavailable day ${dayName}.`);
      }

      if (dayName && restDay && dayName === restDay && trainingItems.length > 0) {
        warnings.push(`${label}: training scheduled on selected rest day ${restDay}.`);
      }

      if (!twoADaysAllowed && trainingItems.length > 1) {
        warnings.push(`${label}: ${dayName ?? date} has ${trainingItems.length} sessions even though two-a-days are disabled.`);
      }

      for (const item of items) {
        if (hasLeadingTitleJunk(item)) {
          warnings.push(`${label}: session title begins with punctuation (${date}).`);
        }
      }
    }

    if (weekSessionCount === 0 && !isRaceWeek(week, userParams.raceDate)) {
      emptyWeeks += 1;
      errors.push(`${label} has no training sessions.`);
    }

    const skipLongSessionChecks = isRaceWeek(week, userParams.raceDate) || String(week.phase ?? '').toLowerCase().includes('taper');
    if (!skipLongSessionChecks) {
      const longRides = allTrainingItems.filter(({ item }) => looksLikeLongRide(item));
      const longRuns = allTrainingItems.filter(({ item }) => looksLikeLongRun(item));

      if (preferredLongRideDay && longRides.length) {
        const badRide = longRides.find(({ date }) => dayNameFromISO(date) !== preferredLongRideDay);
        if (badRide) {
          warnings.push(`${label}: long ride appears on ${dayNameFromISO(badRide.date) ?? badRide.date}, expected ${preferredLongRideDay}.`);
        }
      }

      if (preferredLongRunDay && longRuns.length) {
        const badRun = longRuns.find(({ date }) => dayNameFromISO(date) !== preferredLongRunDay);
        if (badRun) {
          warnings.push(`${label}: long run appears on ${dayNameFromISO(badRun.date) ?? badRun.date}, expected ${preferredLongRunDay}.`);
        }
      }
    }
  });

  if (totalSessions === 0) {
    errors.push('Plan produced zero training sessions.');
  }

  const penalty = errors.length * 20 + warnings.length * 3 + emptyWeeks * 10;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    ok: errors.length === 0,
    score,
    errors,
    warnings,
    stats: {
      expectedWeeks: expected,
      actualWeeks: weeks.length,
      totalSessions,
      emptyWeeks,
    },
  };
}
