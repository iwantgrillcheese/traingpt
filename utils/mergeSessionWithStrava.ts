import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';

export type MergedSession = Omit<Session, 'duration'> & {
  stravaActivity?: StravaActivity;
  duration?: number; // override: optional
  distance_km?: number;
};

/**
 * For each planned session, merge with matching Strava activity (if any).
 * Match is based on exact date and sport type.
 */
export default function mergeSessionWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): MergedSession[] {
  const matchedStravaIds = new Set<string>();

  return sessions.map((session): MergedSession => {
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
        duration: match.moving_time ? match.moving_time / 60 : undefined,
        distance_km: match.distance ? match.distance / 1000 : undefined,
      };
    }

    return session;
  });
}
