import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { parseISO } from 'date-fns';

/**
 * For each planned session, merge with matching Strava activity (if any).
 * Match is based on exact date and sport type.
 */
export default function mergeSessionWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): (Session & { stravaActivity?: StravaActivity; duration?: number; distance_km?: number })[] {
  const matchedStravaIds = new Set<string>();

  return sessions.map((session) => {
    const match = strava.find(
      (a) =>
        a.start_date &&
        new Date(a.start_date).toISOString().slice(0, 10) === session.date &&
        a.sport_type?.toLowerCase() === session.sport?.toLowerCase()
    );

    if (match) {
      matchedStravaIds.add(match.id);
      return {
        ...session,
        stravaActivity: match,
        duration: match.moving_time / 60,
        distance_km: match.distance / 1000,
      };
    }

    return session;
  });
}
