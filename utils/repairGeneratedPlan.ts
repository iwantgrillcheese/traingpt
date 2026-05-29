import { addDays, formatISO, isValid, parseISO } from 'date-fns';
import type { GeneratedPlan, UserParams, WeekJson } from '@/types/plan';

export type PlanRepairResult = {
  plan: GeneratedPlan;
  changes: string[];
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isoDate(date: Date) {
  return formatISO(date, { representation: 'date' });
}

function canonicalWeekDates(startDateISO: string) {
  const start = parseISO(startDateISO);
  if (!isValid(start)) return [];
  return Array.from({ length: 7 }, (_, index) => isoDate(addDays(start, index)));
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

function itemText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    return [record.sport, record.title, record.session_title, record.details, record.description]
      .filter((value) => typeof value === 'string' && value.trim())
      .join(' ');
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

function hasSport(item: unknown, sport: 'swim' | 'bike' | 'run' | 'strength') {
  const text = itemText(item).toLowerCase();
  if (sport === 'bike') return /\b(bike|ride|cycling|ftp)\b/.test(text);
  if (sport === 'run') return /\b(run|running|jog|tempo|threshold|interval|off the bike)\b/.test(text);
  if (sport === 'swim') return /\b(swim|css|pool|open water)\b/.test(text);
  if (sport === 'strength') return /\b(strength|gym|core|mobility)\b/.test(text);
  return false;
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

function isRaceWeek(week: WeekJson, raceDate?: string) {
  if (!raceDate) return false;
  return canonicalWeekDates(week.startDate).includes(raceDate);
}

function ensureCanonicalDays(week: WeekJson): Record<string, unknown[]> {
  const canonical = canonicalWeekDates(week.startDate);
  const existing = week.days && typeof week.days === 'object' && !Array.isArray(week.days) ? week.days : {};
  const next: Record<string, unknown[]> = {};

  for (const date of canonical) {
    const items = (existing as Record<string, unknown>)[date];
    next[date] = Array.isArray(items) ? [...items] : [];
  }

  // Preserve any valid items from non-canonical keys by placing them in empty days.
  const extras = Object.entries(existing as Record<string, unknown>)
    .filter(([date]) => !canonical.includes(date))
    .flatMap(([, items]) => (Array.isArray(items) ? items : []));

  const emptyDates = canonical.filter((date) => next[date].length === 0);
  for (let i = 0; i < Math.min(extras.length, emptyDates.length); i++) {
    next[emptyDates[i]].push(extras[i]);
  }

  week.days = next as Record<string, string[]>;
  return next;
}

function findDateForDay(canonicalDates: string[], targetDay: string | null) {
  if (!targetDay) return null;
  return canonicalDates.find((date) => dayNameFromISO(date) === targetDay) ?? null;
}

function moveItem(days: Record<string, unknown[]>, fromDate: string, toDate: string, item: unknown) {
  if (fromDate === toDate) return false;
  const fromItems = days[fromDate] ?? [];
  const index = fromItems.indexOf(item);
  if (index === -1) return false;
  fromItems.splice(index, 1);
  days[fromDate] = fromItems;
  days[toDate] = [...(days[toDate] ?? []), item];
  return true;
}

function findBestDateForMove({
  canonicalDates,
  days,
  restDay,
  unavailableDays,
  preferredLongRideDate,
  preferredLongRunDate,
  excludeDate,
}: {
  canonicalDates: string[];
  days: Record<string, unknown[]>;
  restDay: string | null;
  unavailableDays: Set<string>;
  preferredLongRideDate: string | null;
  preferredLongRunDate: string | null;
  excludeDate: string;
}) {
  const candidates = canonicalDates
    .filter((date) => date !== excludeDate)
    .filter((date) => dayNameFromISO(date) !== restDay)
    .filter((date) => {
      const dayName = dayNameFromISO(date);
      return !dayName || !unavailableDays.has(dayName);
    })
    .filter((date) => date !== preferredLongRideDate && date !== preferredLongRunDate);

  const fallback = canonicalDates.filter((date) => date !== excludeDate && dayNameFromISO(date) !== restDay);
  const pool = candidates.length ? candidates : fallback;

  return pool.sort((a, b) => {
    const aCount = (days[a] ?? []).filter(isTrainingSession).length;
    const bCount = (days[b] ?? []).filter(isTrainingSession).length;
    return aCount - bCount;
  })[0] ?? null;
}

export function repairGeneratedPlan({
  plan,
  userParams,
}: {
  plan: GeneratedPlan;
  userParams: UserParams;
}): PlanRepairResult {
  const changes: string[] = [];
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const restDay = normalizeDayName(userParams.restDay);
  const unavailableDays = new Set((userParams.unavailableDays ?? []).map(normalizeDayName).filter(Boolean) as string[]);
  const preferredLongRideDay = normalizeDayName(userParams.preferredLongRideDay);
  const preferredLongRunDay = normalizeDayName(userParams.preferredLongRunDay);

  for (const week of weeks) {
    if (!week || typeof week !== 'object') continue;
    const canonicalDates = canonicalWeekDates(week.startDate);
    if (canonicalDates.length !== 7) continue;

    const days = ensureCanonicalDays(week);
    const raceWeek = isRaceWeek(week, userParams.raceDate);
    const taperWeek = String(week.phase ?? '').toLowerCase().includes('taper');
    const preferredLongRideDate = findDateForDay(canonicalDates, preferredLongRideDay);
    const preferredLongRunDate = findDateForDay(canonicalDates, preferredLongRunDay);

    if (!raceWeek && !taperWeek) {
      if (preferredLongRideDate) {
        const sourceDate = canonicalDates.find((date) => (days[date] ?? []).some(looksLikeLongRide));
        if (sourceDate && sourceDate !== preferredLongRideDate) {
          const item = (days[sourceDate] ?? []).find(looksLikeLongRide);
          if (item && moveItem(days, sourceDate, preferredLongRideDate, item)) {
            changes.push(`${week.label}: moved long ride from ${dayNameFromISO(sourceDate)} to ${preferredLongRideDay}.`);
          }
        }
      }

      if (preferredLongRunDate) {
        const sourceDate = canonicalDates.find((date) => (days[date] ?? []).some(looksLikeLongRun));
        if (sourceDate && sourceDate !== preferredLongRunDate) {
          const item = (days[sourceDate] ?? []).find(looksLikeLongRun);
          if (item && moveItem(days, sourceDate, preferredLongRunDate, item)) {
            changes.push(`${week.label}: moved long run from ${dayNameFromISO(sourceDate)} to ${preferredLongRunDay}.`);
          }
        }
      }
    }

    for (const date of canonicalDates) {
      const dayName = dayNameFromISO(date);
      const violatesRest = !!restDay && dayName === restDay;
      const violatesUnavailable = !!dayName && unavailableDays.has(dayName);
      if (!violatesRest && !violatesUnavailable) continue;

      const items = [...(days[date] ?? [])];
      for (const item of items) {
        if (!isTrainingSession(item)) continue;
        if (raceWeek && /race day|\brace\b/i.test(itemText(item))) continue;

        const target = looksLikeLongRide(item)
          ? preferredLongRideDate
          : looksLikeLongRun(item)
            ? preferredLongRunDate
            : findBestDateForMove({
                canonicalDates,
                days,
                restDay,
                unavailableDays,
                preferredLongRideDate,
                preferredLongRunDate,
                excludeDate: date,
              });

        if (target && moveItem(days, date, target, item)) {
          changes.push(`${week.label}: moved training off ${dayName ?? date} to ${dayNameFromISO(target) ?? target}.`);
        }
      }
    }
  }

  return { plan, changes };
}
