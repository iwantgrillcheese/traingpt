import type { WeekJson } from '@/types/plan';
import { SchedulingConflict } from './sportAvailability.ts';

type Workout = Exclude<WeekJson['days'][string][number], string>;

/** Useful training durations; race openers/transition runs have distinct floors. */
export function usefulMinimum(item: Workout): number {
  const floors: Record<string, number> = {
    swim_technique: 30, swim_endurance: 30, swim_race_prep: 20,
    bike_endurance: 30, bike_quality: 40, bike_opener: 20,
    run_easy: 25, run_quality: 30, run_opener: 15, brick_run: 8, strength: 20,
  };
  return Math.min(item.durationMinutes ?? 0, floors[item.type ?? ''] ?? 30);
}

export function retimeWorkout(item: Workout, minutes: number): Workout {
  const durationMinutes = Math.round(minutes);
  const details = item.details?.replace(/(Workout:\s*)(?:\d+h(?:\s+\d+min)?|\d+min)(?:\s+total)?\.?/i, `$1${durationMinutes}min.`);
  return { ...item, durationMinutes, ...(details ? { details } : {}) };
}

/** Allocate the week before safety guards. Anchors never fund support workouts.
 * If useful supporting workouts cannot fit, remove slots rather than emit fragments.
 */
export function allocateTriathlonWeek(week: WeekJson, budgetMinutes: number): WeekJson {
  if (!Number.isFinite(budgetMinutes) || budgetMinutes <= 0) return week;
  const items = Object.values(week.days).flat().filter((s): s is Workout => typeof s !== 'string' && s.type !== 'race_day');
  let excess = items.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0) - Math.floor(budgetMinutes);
  if (excess <= 0) return week;
  const durations = new Map(items.map(s => [s, s.durationMinutes ?? 0]));
  const removed = new Set<Workout>();
  for (const priority of ['optional', 'support', 'key']) {
    const candidates = items.filter(s => s.priority !== 'anchor' && (s.priority ?? 'support') === priority);
    // Distribute reductions, avoiding one support session absorbing the entire cut.
    while (excess > 0) {
      const available = candidates.filter(s => durations.get(s)! > usefulMinimum(s));
      if (!available.length) break;
      for (const item of available) {
        if (excess <= 0) break;
        durations.set(item, durations.get(item)! - 1);
        excess -= 1;
      }
    }
  }
  const removable = items.filter(s => s.priority !== 'anchor' && s.type !== 'brick_run')
    .sort((a, b) => (a.priority === 'optional' ? 0 : a.type === 'swim_endurance' ? 1 : 2) - (b.priority === 'optional' ? 0 : b.type === 'swim_endurance' ? 1 : 2));
  for (const item of removable) {
    if (excess <= 0) break;
    removed.add(item);
    excess -= durations.get(item)!;
  }
  if (excess > 0) throw new SchedulingConflict('The weekly hours cannot fit useful anchor sessions. Increase available hours or choose a shorter event.');
  return { ...week, days: Object.fromEntries(Object.entries(week.days).map(([date, slots]) => [date, slots.filter(s => typeof s === 'string' || !removed.has(s)).map(s => typeof s === 'string' || s.type === 'race_day' ? s : retimeWorkout(s, durations.get(s)!))])),
    debug: [week.debug, 'Allocated useful session slots within weekly hours before safety guards.'].filter(Boolean).join('\n') };
}
