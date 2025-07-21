import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { EnrichedSession } from '@/types/calendar';

/**
 * Merges planned sessions with any matching Strava activities.
 * A Strava activity replaces a session if the date and sport match.
 */
export function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): EnrichedSession[] {
  return sessions.map((session) => {
    const match = strava.find((activity) => {
      const sameDate = activity.date === session.date;
      const sameSport = activity.sport.toLowerCase() === session.sport.toLowerCase();
      return sameDate && sameSport;
    });

    return {
      ...session,
      stravaActivity: match ?? null,
    } as EnrichedSession;
  });
}
