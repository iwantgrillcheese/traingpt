import { format, isValid, parseISO } from 'date-fns';
import type { DayOfWeek, WeekJson } from '@/types/plan';

type StructuredSession = Record<string, unknown> & {
  type?: string;
  sport?: string;
  title?: string;
  priority?: 'anchor' | 'key' | 'support' | 'optional';
  durationMinutes?: number;
};

type SessionGroup = {
  items: StructuredSession[];
  originalDate: string;
  score: number;
  kind: 'race' | 'brick' | 'single';
};

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function dayName(date: string) {
  const parsed = parseISO(date);
  return isValid(parsed) ? format(parsed, 'EEEE') : '';
}

function normalizedDays(values: DayOfWeek[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));
}

function typeOf(item: StructuredSession) { return String(item.type ?? '').toLowerCase(); }
function sportOf(item: StructuredSession) { return String(item.sport ?? '').toLowerCase(); }

function priorityScore(item: StructuredSession) {
  const type = typeOf(item);
  if (type === 'race_day') return 100;
  if (type === 'long_ride' || type === 'long_run' || type === 'brick_run') return 90;
  if (type === 'swim_technique') return 75;
  if (type === 'bike_quality' || type === 'bike_endurance' || type === 'run_quality') return 70;
  if (type === 'swim_endurance') return 55;
  if (item.priority === 'anchor') return 85;
  if (item.priority === 'key') return 70;
  if (item.priority === 'support') return 50;
  return 25;
}

function groupsForWeek(week: WeekJson): SessionGroup[] {
  const groups: SessionGroup[] = [];
  for (const [date, rawItems] of Object.entries(week.days ?? {})) {
    const items = (Array.isArray(rawItems) ? rawItems : []).filter(isRecord) as StructuredSession[];
    const race = items.filter((item) => typeOf(item) === 'race_day');
    race.forEach((item) => groups.push({ items: [item], originalDate: date, score: 100, kind: 'race' }));

    const ride = items.find((item) => typeOf(item) === 'long_ride');
    const brick = items.find((item) => typeOf(item) === 'brick_run');
    const grouped = new Set<StructuredSession>();
    if (ride && brick) {
      grouped.add(ride);
      grouped.add(brick);
      groups.push({ items: [ride, brick], originalDate: date, score: 95, kind: 'brick' });
    }

    items.forEach((item) => {
      if (race.includes(item) || grouped.has(item)) return;
      groups.push({ items: [item], originalDate: date, score: priorityScore(item), kind: 'single' });
    });
  }
  return groups.sort((a, b) => b.score - a.score);
}

function containsRace(group: SessionGroup) { return group.kind === 'race'; }

function preferredDateFor(group: SessionGroup, availableDates: string[], preferredLongRideDay?: DayOfWeek, preferredLongRunDay?: DayOfWeek) {
  const types = group.items.map(typeOf);
  const preferred = types.includes('long_ride') ? preferredLongRideDay : types.includes('long_run') ? preferredLongRunDay : undefined;
  if (!preferred) return null;
  const normalized = String(preferred).toLowerCase();
  return availableDates.find((date) => dayName(date).toLowerCase() === normalized) ?? null;
}

function sameDayAllowed(existing: StructuredSession[], incoming: SessionGroup, twoADaysAllowed: boolean) {
  if (!existing.length) return true;
  if (twoADaysAllowed) return true;
  if (incoming.kind === 'brick') return false;
  const all = [...existing, ...incoming.items];
  const hasBike = all.some((item) => sportOf(item) === 'bike');
  const hasBrickRun = all.some((item) => typeOf(item) === 'brick_run');
  if (hasBike && hasBrickRun && all.length === 2) return true;
  const strength = all.filter((item) => sportOf(item) === 'strength');
  const endurance = all.filter((item) => ['swim', 'bike', 'run'].includes(sportOf(item)));
  return all.length === 2 && strength.length === 1 && endurance.length === 1 && Number(strength[0].durationMinutes ?? 0) <= 35;
}

export function enforceTriathlonScheduleConstraints({
  weeks,
  raceDate,
  restDay,
  unavailableDays,
  preferredLongRideDay,
  preferredLongRunDay,
  twoADaysAllowed = false,
}: {
  weeks: WeekJson[];
  raceDate?: string;
  restDay?: DayOfWeek;
  unavailableDays?: DayOfWeek[];
  preferredLongRideDay?: DayOfWeek;
  preferredLongRunDay?: DayOfWeek;
  twoADaysAllowed?: boolean;
}): { weeks: WeekJson[]; movedSessions: number; droppedSessions: number } {
  const blockedNames = normalizedDays([...(unavailableDays ?? []), ...(restDay ? [restDay] : [])]);
  let movedSessions = 0;
  let droppedSessions = 0;

  const nextWeeks = weeks.map((week) => {
    const dates = Object.keys(week.days ?? {}).sort();
    if (!dates.length) return week;
    const availableDates = dates.filter((date) => !blockedNames.has(dayName(date).toLowerCase()) || date === raceDate);
    const output: Record<string, StructuredSession[]> = Object.fromEntries(dates.map((date) => [date, []]));
    const groups = groupsForWeek(week);

    for (const group of groups) {
      if (containsRace(group)) {
        const target = raceDate && output[raceDate] ? raceDate : group.originalDate;
        output[target] = [...output[target], ...group.items];
        continue;
      }

      const originalAllowed = availableDates.includes(group.originalDate) && sameDayAllowed(output[group.originalDate], group, twoADaysAllowed);
      const preferred = preferredDateFor(group, availableDates, preferredLongRideDay, preferredLongRunDay);
      const preferredAllowed = preferred && sameDayAllowed(output[preferred], group, twoADaysAllowed) ? preferred : null;
      const emptyCandidate = availableDates.find((date) => output[date].length === 0);
      const pairCandidate = availableDates.find((date) => sameDayAllowed(output[date], group, twoADaysAllowed));
      const target = preferredAllowed ?? (originalAllowed ? group.originalDate : null) ?? emptyCandidate ?? pairCandidate ?? null;

      if (!target) {
        droppedSessions += group.items.length;
        continue;
      }

      if (target !== group.originalDate) movedSessions += group.items.length;
      output[target] = [...output[target], ...group.items];
    }

    return {
      ...week,
      days: output,
      debug: [week.debug, movedSessions || droppedSessions ? 'Applied athlete availability and rest-day schedule constraints.' : null].filter(Boolean).join('\n'),
    } as WeekJson;
  });

  return { weeks: nextWeeks, movedSessions, droppedSessions };
}
