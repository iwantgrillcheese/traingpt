// /utils/computeCompliance.ts
import type { Session } from '@/types/session';
import { startOfWeek, endOfWeek, parseISO, isWithinInterval, isEqual, isBefore } from 'date-fns';

/**
 * Computes the user's adherence to their plan for the current training week (Mon–Sun).
 * @param planned Array of sessions from the training plan
 * @param completed Array of sessions completed via Strava or manually
 * @returns Percent of sessions completed out of those planned for the current week
 */
export function computeCompliance(planned: Session[], completed: Session[]): number {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const isThisWeek = (d: string) =>
    isWithinInterval(parseISO(d), { start: weekStart, end: weekEnd });

  const plannedThisWeek = planned.filter((s) => isThisWeek(s.date));
  const completedThisWeek = completed.filter((s) => isThisWeek(s.date));

  const completedDates = new Set(
    completedThisWeek.map((s) => parseISO(s.date).toISOString().slice(0, 10))
  );

  const completedCount = plannedThisWeek.filter((s) =>
    completedDates.has(parseISO(s.date).toISOString().slice(0, 10))
  ).length;

  if (plannedThisWeek.length === 0) return 0;
  return Math.round((completedCount / plannedThisWeek.length) * 100);
}
