// utils/mergeSessionWithStrava.ts

import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';

export type MergedSession = Omit<Session, 'duration'> & {
  stravaActivity?: StravaActivity;
  duration?: number;
  distance_km?: number;
};

export type MergedResult = {
  merged: MergedSession[];
  unmatched: StravaActivity[];
};

export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): MergedResult {
  const matchedIds = new Set<string>();

  const merged: MergedSession[] = sessions.map((session) => {
    const sessionDate = session.date;
    const sessionSport = session.sport?.toLowerCase();

    const match = strava.find((a) => {
      const activityDate = new Date(a.start_date).toISOString().slice(0, 10);
      const activitySport = a.sport_type?.toLowerCase();

      const matched =
        activityDate === sessionDate && activitySport === sessionSport;

      if (matched) matchedIds.add(a.id);
      return matched;
    });

    return {
      ...session,
      stravaActivity: match,
      duration: match?.moving_time ? match.moving_time / 60 : undefined,
      distance_km: match?.distance ? match.distance / 1000 : undefined,
    };
  });

  const unmatched = strava.filter((a) => !matchedIds.has(a.id));

  return { merged, unmatched };
}
