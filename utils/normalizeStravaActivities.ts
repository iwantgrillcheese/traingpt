import { StravaActivity } from '@/types/strava';
import { toZonedTime } from 'date-fns-tz';
import { formatISO, parseISO } from 'date-fns';

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Normalizes Strava activities into a map grouped by local date.
 * Deduplicates by `strava_id`, adds a `local_date` field, and returns:
 *   { '2025-10-06': [activity1, activity2], ... }
 */
export function normalizeStravaActivities(
  activities: StravaActivity[],
  userTimezone: string = DEFAULT_TIMEZONE
): Record<string, StravaActivity[]> {
  const seen = new Set<number>();
  const grouped: Record<string, StravaActivity[]> = {};

  for (const act of activities) {
    // Skip duplicates
    if (seen.has(act.strava_id)) continue;
    seen.add(act.strava_id);

    // Convert to user's local timezone
    const localDate = formatISO(
      toZonedTime(parseISO(act.start_date), userTimezone),
      { representation: 'date' }
    );

    const normalized = {
      ...act,
      local_date: localDate,
    };

    // Group by local date
    if (!grouped[localDate]) grouped[localDate] = [];
    grouped[localDate].push(normalized);
  }

  return grouped;
}
