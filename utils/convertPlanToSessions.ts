// /utils/convertPlanToSessions.ts
import type { WeekJson, Session } from '@/types/plan';

/**
 * Convert a structured plan (weeks JSON) into atomic session rows
 * that align with the `sessions` table schema.
 *
 * NOTE: `user_id` and `plan_id` should be attached by the caller before inserting.
 */
export function convertPlanToSessions(
  weeks: WeekJson[]
): Omit<Session, 'user_id' | 'plan_id'>[] {
  const rows: Omit<Session, 'user_id' | 'plan_id'>[] = [];

  for (const week of weeks) {
    // sort days chronologically for consistency
    const sortedDays = Object.entries(week.days).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    );

    for (const [date, items] of sortedDays) {
      items.forEach((raw) => {
        // Normalize workout string → "Title — Description"
        const [titlePart, ...descParts] = String(raw).split(' — ');
        const title = titlePart?.trim() || 'Workout';
        const description = descParts.join(' — ').trim() || 'Details';
        const session_title = `${title} — ${description}`;

        rows.push({
          session_date: date,
          session_title,
          status: 'planned', // default when plan is created
          strava_id: null,
        });
      });
    }
  }

  return rows;
}
