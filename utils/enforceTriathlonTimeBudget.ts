import type { WeekJson } from '@/types/plan';

type Priority = 'anchor' | 'key' | 'support' | 'optional';
type StructuredSession = Record<string, unknown> & {
  type?: string;
  title?: string;
  priority?: Priority;
  durationMinutes?: number;
  details?: string;
};

type BudgetResult = {
  weeks: WeekJson[];
  adjustedWeeks: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function durationOf(item: unknown): number {
  if (!isRecord(item)) return 0;
  const value = Number(item.durationMinutes);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function priorityOf(item: StructuredSession): Priority {
  if (item.priority === 'anchor' || item.priority === 'key' || item.priority === 'support' || item.priority === 'optional') return item.priority;
  return 'support';
}

function floorFor(item: StructuredSession, original: number): number {
  const type = String(item.type ?? '').toLowerCase();
  if (type === 'race_day') return original;
  const priority = priorityOf(item);
  if (priority === 'anchor') return Math.max(30, Math.round(original * 0.72));
  if (priority === 'key') return Math.max(20, Math.round(original * 0.6));
  if (priority === 'support') return Math.max(15, Math.round(original * 0.5));
  return Math.min(original, 10);
}

function formatDuration(minutes: number) {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded}min`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

function retimeDetails(details: unknown, minutes: number): string | undefined {
  if (typeof details !== 'string') return undefined;
  const formatted = formatDuration(minutes);
  if (/Workout:\s*(?:\d+h(?:\s+\d+min)?|\d+min)\.?/i.test(details)) {
    return details.replace(/(Workout:\s*)(?:\d+h(?:\s+\d+min)?|\d+min)(\.?)/i, `$1${formatted}$2`);
  }
  return details;
}

function retime(item: StructuredSession, minutes: number): StructuredSession {
  const next = { ...item, durationMinutes: Math.max(1, Math.round(minutes)) };
  const details = retimeDetails(item.details, next.durationMinutes);
  if (details) next.details = details;
  return next;
}

function isRaceWeek(week: WeekJson, raceDate?: string) {
  return Boolean(raceDate && week.days && Object.prototype.hasOwnProperty.call(week.days, raceDate));
}

export function enforceTriathlonTimeBudget({
  weeks,
  maxHours,
  raceDate,
}: {
  weeks: WeekJson[];
  maxHours: number;
  raceDate?: string;
}): BudgetResult {
  if (!Number.isFinite(maxHours) || maxHours <= 0) return { weeks, adjustedWeeks: 0 };
  const budget = Math.round(maxHours * 60);
  let adjustedWeeks = 0;

  const nextWeeks = weeks.map((week) => {
    if (isRaceWeek(week, raceDate)) return week;
    const days = isRecord(week.days) ? week.days : {};
    const slots: Array<{ date: string; index: number; item: StructuredSession; duration: number; floor: number; priority: Priority }> = [];

    Object.entries(days).forEach(([date, rawItems]) => {
      const items = Array.isArray(rawItems) ? rawItems : [];
      items.forEach((raw, index) => {
        if (!isRecord(raw)) return;
        const item = raw as StructuredSession;
        const duration = durationOf(item);
        if (duration <= 0 || String(item.type ?? '').toLowerCase() === 'race_day') return;
        slots.push({ date, index, item, duration, floor: floorFor(item, duration), priority: priorityOf(item) });
      });
    });

    const total = slots.reduce((sum, slot) => sum + slot.duration, 0);
    if (!slots.length || total <= budget) return week;

    let excess = total - budget;
    const order: Priority[] = ['optional', 'support', 'key', 'anchor'];
    const nextDurations = new Map(slots.map((slot) => [slot, slot.duration]));

    for (const priority of order) {
      const candidates = slots.filter((slot) => slot.priority === priority).sort((a, b) => b.duration - a.duration);
      for (const slot of candidates) {
        if (excess <= 0) break;
        const current = nextDurations.get(slot) ?? slot.duration;
        const reducible = Math.max(0, current - slot.floor);
        const reduction = Math.min(reducible, excess);
        nextDurations.set(slot, current - reduction);
        excess -= reduction;
      }
    }

    // If the athlete selected an exceptionally low cap, keep the plan truthful:
    // fit the week instead of silently exceeding the stated availability.
    if (excess > 0) {
      const candidates = slots.slice().sort((a, b) => (nextDurations.get(b) ?? b.duration) - (nextDurations.get(a) ?? a.duration));
      for (const slot of candidates) {
        if (excess <= 0) break;
        const current = nextDurations.get(slot) ?? slot.duration;
        const absoluteFloor = slot.priority === 'anchor' ? 25 : 10;
        const reducible = Math.max(0, current - absoluteFloor);
        const reduction = Math.min(reducible, excess);
        nextDurations.set(slot, current - reduction);
        excess -= reduction;
      }
    }

    const nextDays: Record<string, any[]> = Object.fromEntries(
      Object.entries(days).map(([date, rawItems]) => [date, Array.isArray(rawItems) ? [...rawItems] : []])
    );

    for (const slot of slots) {
      const minutes = nextDurations.get(slot) ?? slot.duration;
      nextDays[slot.date][slot.index] = retime(slot.item, minutes);
    }

    adjustedWeeks += 1;
    return {
      ...week,
      days: nextDays,
      debug: [week.debug, `Weekly time budget enforced at ${maxHours}h.`].filter(Boolean).join('\n'),
    } as WeekJson;
  });

  return { weeks: nextWeeks, adjustedWeeks };
}
