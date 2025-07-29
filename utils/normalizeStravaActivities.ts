import { StravaActivity } from '@/types/strava';
import { toZonedTime } from 'date-fns-tz';
import { formatISO, parseISO } from 'date-fns';

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export function normalizeStravaActivities(
  activities: StravaActivity[],
  userTimezone: string = DEFAULT_TIMEZONE
): StravaActivity[] {
  const seen = new Set<number>();
  const deduped: StravaActivity[] = [];

  for (const act of activities) {
    if (seen.has(act.strava_id)) continue;
    seen.add(act.strava_id);

    const localDate = formatISO(
      toZonedTime(parseISO(act.start_date), userTimezone),
      { representation: 'date' }
    );

    deduped.push({
      ...act,
      local_date: localDate, // new field for use in calendar
    });
  }

  return deduped;
}
