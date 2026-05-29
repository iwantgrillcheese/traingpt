import { addDays, formatISO, isValid, parseISO } from 'date-fns';
import type { GeneratedPlan, UserParams, WeekJson } from '@/types/plan';

export type PlanRepairResult = {
  plan: GeneratedPlan;
  changes: string[];
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'other';

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

function hasSport(item: unknown, sport: Sport) {
  const text = itemText(item).toLowerCase();
  if (sport === 'bike') return /\b(bike|ride|cycling|ftp)\b/.test(text);
  if (sport === 'run') return /\b(run|running|jog|tempo|threshold|interval|off the bike)\b/.test(text);
  if (sport === 'swim') return /\b(swim|css|pool|open water)\b/.test(text);
  if (sport === 'strength') return /\b(strength|gym|core|mobility)\b/.test(text);
  return false;
}

function primarySport(item: unknown): Sport {
  const text = itemText(item).toLowerCase();
  if (hasSport(item, 'swim')) return 'swim';
  if (hasSport(item, 'bike')) return 'bike';
  if (hasSport(item, 'run')) return 'run';
  if (hasSport(item, 'strength')) return 'strength';
  return 'other';
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

function isBrickBike(item: unknown) {
  return /\bbrick\s+bike\b|\bbrick\b.*\b(bike|ride)\b/i.test(itemText(item));
}

function isBrickRun(item: unknown) {
  return /\bbrick\s+run\b|\brun\s+off\s+the\s+bike\b|\boff\s+the\s+bike\b/i.test(itemText(item));
}

function isHardBike(item: unknown) {
  return hasSport(item, 'bike') && /\b(threshold|ftp|interval|tempo|vo2|hard|90-?95|95|100%)\b/i.test(itemText(item));
}

function isHardRun(item: unknown) {
  return hasSport(item, 'run') && /\b(threshold|interval|tempo|hard|race pace|5k|10k)\b/i.test(itemText(item));
}

function sessionLoadScore(item: unknown): number {
  const text = itemText(item).toLowerCase();
  const minutes = parseDurationMinutes(text) ?? 0;
  let score = minutes;
  if (looksLikeLongRide(item) || looksLikeLongRun(item)) score += 200;
  if (/\blong\b/.test(text)) score += 100;
  if (/\bthreshold|interval|tempo|ftp|race pace\b/.test(text)) score += 40;
  if (/\bbrick\b/.test(text)) score += 15;
  return score;
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

  // Preserve valid items from non-canonical keys by placing them in empty days.
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

function removeItem(days: Record<string, unknown[]>, date: string, item: unknown) {
  const items = days[date] ?? [];
  const next = items.filter((candidate) => candidate !== item);
  if (next.length === items.length) return false;
  days[date] = next;
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

function cleanupOverloadedDay({
  week,
  date,
  days,
  preferredLongRideDate,
  preferredLongRunDate,
  changes,
}: {
  week: WeekJson;
  date: string;
  days: Record<string, unknown[]>;
  preferredLongRideDate: string | null;
  preferredLongRunDate: string | null;
  changes: string[];
}) {
  const label = week.label || 'Week';
  const items = days[date] ?? [];
  const trainingItems = items.filter(isTrainingSession);
  if (trainingItems.length <= 1) return;

  const isPreferredLongRideDay = preferredLongRideDate === date;
  const isPreferredLongRunDay = preferredLongRunDate === date;
  const dayName = dayNameFromISO(date) ?? date;

  // Strength should supplement the plan, not duplicate itself on one day.
  const strengthItems = trainingItems.filter((item) => hasSport(item, 'strength'));
  if (strengthItems.length > 1) {
    const [keep, ...drop] = strengthItems.sort((a, b) => sessionLoadScore(b) - sessionLoadScore(a));
    for (const item of drop) {
      if (removeItem(days, date, item)) changes.push(`${label}: removed duplicate strength session on ${dayName}.`);
    }
    // Keep reference to avoid lint complaints in strict projects.
    void keep;
  }

  // On the long ride day, keep one main bike stimulus. Brick run is allowed.
  if (isPreferredLongRideDay) {
    const bikeItems = (days[date] ?? []).filter((item) => isTrainingSession(item) && hasSport(item, 'bike'));
    if (bikeItems.length > 1) {
      const keep = bikeItems.sort((a, b) => sessionLoadScore(b) - sessionLoadScore(a))[0];
      for (const item of bikeItems) {
        if (item === keep) continue;
        // If a separate long ride exists, remove duplicate endurance/threshold/brick-bike sessions.
        if (removeItem(days, date, item)) changes.push(`${label}: removed duplicate bike session on long ride day ${dayName}.`);
      }
    }

    const hardRuns = (days[date] ?? []).filter((item) => isTrainingSession(item) && hasSport(item, 'run') && isHardRun(item) && !isBrickRun(item));
    for (const item of hardRuns) {
      if (removeItem(days, date, item)) changes.push(`${label}: removed hard run stacked on long ride day ${dayName}.`);
    }
  }

  // On the long run day, keep one main run stimulus and avoid competing bike intensity.
  if (isPreferredLongRunDay) {
    const runItems = (days[date] ?? []).filter((item) => isTrainingSession(item) && hasSport(item, 'run'));
    if (runItems.length > 1) {
      const keep = runItems.sort((a, b) => sessionLoadScore(b) - sessionLoadScore(a))[0];
      for (const item of runItems) {
        if (item === keep) continue;
        if (removeItem(days, date, item)) changes.push(`${label}: removed duplicate run session on long run day ${dayName}.`);
      }
    }

    const hardBikes = (days[date] ?? []).filter((item) => isTrainingSession(item) && hasSport(item, 'bike') && isHardBike(item));
    for (const item of hardBikes) {
      if (removeItem(days, date, item)) changes.push(`${label}: removed hard bike stacked on long run day ${dayName}.`);
    }
  }

  // Generic cleanup: avoid more than one non-brick bike or run per day.
  for (const sport of ['bike', 'run'] as const) {
    const sportItems = (days[date] ?? []).filter((item) => isTrainingSession(item) && hasSport(item, sport));
    if (sportItems.length <= 1) continue;

    // Bike day may have one bike + brick run. Run day may have one long run only.
    const keep = sportItems.sort((a, b) => sessionLoadScore(b) - sessionLoadScore(a))[0];
    for (const item of sportItems) {
      if (item === keep) continue;
      if (sport === 'run' && isPreferredLongRideDay && isBrickRun(item)) continue;
      if (removeItem(days, date, item)) changes.push(`${label}: removed duplicate ${sport} session on ${dayName}.`);
    }
  }

  // Hard cap: no more than three training sessions on any day after repair.
  let currentTraining = (days[date] ?? []).filter(isTrainingSession);
  while (currentTraining.length > 3) {
    const removable = [...currentTraining]
      .filter((item) => !looksLikeLongRide(item) && !looksLikeLongRun(item))
      .sort((a, b) => sessionLoadScore(a) - sessionLoadScore(b))[0];

    if (!removable || !removeItem(days, date, removable)) break;
    changes.push(`${label}: removed low-priority overloaded session on ${dayName}.`);
    currentTraining = (days[date] ?? []).filter(isTrainingSession);
  }
}

function cleanupWeeklyStrength({
  week,
  canonicalDates,
  days,
  changes,
}: {
  week: WeekJson;
  canonicalDates: string[];
  days: Record<string, unknown[]>;
  changes: string[];
}) {
  const strengthItems = canonicalDates.flatMap((date) =>
    (days[date] ?? [])
      .filter((item) => isTrainingSession(item) && hasSport(item, 'strength'))
      .map((item) => ({ date, item }))
  );

  if (strengthItems.length <= 3) return;

  // Keep the first three by date/order. Strength is optional accessory work; extra sessions create junk plans.
  const extras = strengthItems.slice(3);
  for (const { date, item } of extras) {
    if (removeItem(days, date, item)) {
      changes.push(`${week.label}: removed extra strength session beyond 3/week on ${dayNameFromISO(date) ?? date}.`);
    }
  }
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

    for (const date of canonicalDates) {
      cleanupOverloadedDay({
        week,
        date,
        days,
        preferredLongRideDate,
        preferredLongRunDate,
        changes,
      });
    }

    cleanupWeeklyStrength({ week, canonicalDates, days, changes });

    // Ensure stored days is a plain date -> session array object after all mutations.
    week.days = Object.fromEntries(canonicalDates.map((date) => [date, days[date] ?? []])) as Record<string, string[]>;
  }

  return { plan, changes };
}
