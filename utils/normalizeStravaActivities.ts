import { formatISO, isValid, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { StravaActivity } from '@/types/strava';

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

function stravaKey(activity: StravaActivity): string {
  return String(activity.strava_id ?? activity.id);
}

function getActivityTimestamp(activity: StravaActivity): string | null {
  return activity.start_date_local || activity.start_date || null;
}

function getLocalDate(activity: StravaActivity, userTimezone: string): string | null {
  if (activity.local_date) return activity.local_date;

  const timestamp = getActivityTimestamp(activity);
  if (!timestamp) return null;

  try {
    const parsed = parseISO(timestamp);
    if (!isValid(parsed)) return null;

    return formatISO(toZonedTime(parsed, userTimezone), {
      representation: 'date',
    });
  } catch {
    return null;
  }
}

/**
 * Groups activities by athlete-local date (YYYY-MM-DD), dedupes by Strava id,
 * and defensively skips malformed activity rows instead of crashing the page.
 */
export function normalizeStravaActivities(
  activities: StravaActivity[],
  userTimezone: string = DEFAULT_TIMEZONE
): Record<string, StravaActivity[]> {
  const seen = new Set<string>();
  const grouped: Record<string, StravaActivity[]> = {};

  for (const activity of activities ?? []) {
    const key = stravaKey(activity);
    if (!key || seen.has(key)) continue;

    seen.add(key);

    const localDate = getLocalDate(activity, userTimezone);
    if (!localDate) continue;

    const normalized: StravaActivity = {
      ...activity,
      local_date: localDate,
    };

    if (!grouped[localDate]) grouped[localDate] = [];
    grouped[localDate].push(normalized);
  }

  return grouped;
}
