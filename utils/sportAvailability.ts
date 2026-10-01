import type { SportAvailability, TrainingSport } from '@/types/plan';

export const TRAINING_SPORTS: TrainingSport[] = ['swim', 'bike', 'run', 'strength'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export class SchedulingConflict extends Error {}

export function normalizeSportAvailability(value: unknown): SportAvailability | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new SchedulingConflict('Sport availability must contain day lists.');
  const result: SportAvailability = {};
  for (const sport of TRAINING_SPORTS) {
    const days = (value as Record<string, unknown>)[sport];
    if (days === undefined) continue;
    if (!Array.isArray(days) || days.some(day => !DAY_NAMES.includes(day))) throw new SchedulingConflict(`Choose valid days for ${sport}.`);
    result[sport] = [...new Set(days)];
  }
  return Object.keys(result).length ? result : undefined;
}

export function sportAllowed(date: string, sport: string, availability?: SportAvailability): boolean {
  const allowed = availability?.[sport.toLowerCase() as TrainingSport];
  return allowed === undefined || allowed.includes(DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()]);
}
