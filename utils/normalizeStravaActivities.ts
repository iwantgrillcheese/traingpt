import { StravaActivity } from '@/types/strava';
import { toZonedTime } from 'date-fns-tz';
import { formatISO, parseISO } from 'date-fns';

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

function stravaKey(act: StravaActivity): string {
  return String(act.strava_id ?? act.id);
}

/**
 * Groups activities by user's local date (YYYY-MM-DD) and dedupes them.
 */
export function normalizeStravaActivities(
  activities: StravaActivity[],
  userTimezone: string = DEFAULT_TIMEZONE
): Record<string, StravaActivity[]> {
  const seen = new Set<string>();
  const grouped: Record<string, StravaActivity[]> = {};

  for (const act of activities) {
    const key = stravaKey(act);
    if (seen.has(key)) continue;
    seen.add(key);

    const localDate = formatISO(
      toZonedTime(parseISO(act.start_date), userTimezone),
      { representation: 'date' }
    );

    const normalized: StravaActivity = {
      ...act,
      local_date: localDate,
    };

    if (!grouped[localDate]) grouped[localDate] = [];
    grouped[localDate].push(normalized);
  }

  return grouped;
}
