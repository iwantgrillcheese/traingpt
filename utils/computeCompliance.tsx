// /utils/computeCompliance.ts
import type { Session } from '@/types/session';

/**
 * Computes the user's adherence to their plan over the last 7 days.
 * @param planned Array of sessions from the training plan
 * @param completed Array of sessions completed via Strava
 * @returns Percent of sessions completed out of those planned in last 7 days
 */
export function computeCompliance(planned: Session[], completed: Session[]): number {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const plannedLast7 = planned.filter((s) => {
    const date = new Date(s.date);
    return date >= sevenDaysAgo && date <= now;
  });

  const completedDates = new Set(
    completed.map((s) => new Date(s.date).toISOString().slice(0, 10))
  );

  const completedCount = plannedLast7.filter((s) =>
    completedDates.has(new Date(s.date).toISOString().slice(0, 10))
  ).length;

  if (plannedLast7.length === 0) return 0;
  return Math.round((completedCount / plannedLast7.length) * 100);
}
