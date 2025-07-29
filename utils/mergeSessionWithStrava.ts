import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';

export type MergedSession = Omit<Session, 'duration'> & {
  stravaActivity?: StravaActivity;
  duration?: number;
  distance_km?: number;
};

export type MergedResult = {
  merged: MergedSession[];
  unmatched: StravaActivity[];
};

function isDurationSimilar(estimatedMinutes: number | null, stravaSeconds: number): boolean {
  if (!estimatedMinutes) return true;
  const stravaMinutes = stravaSeconds / 60;
  const diff = Math.abs(stravaMinutes - estimatedMinutes);
  return diff / estimatedMinutes <= 0.2; // within 20%
}

export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): MergedResult {
  const matchedIds = new Set<string>();

  const merged: MergedSession[] = sessions.map((session) => {
    const sessionDate = session.date;
    const sessionSport = session.sport?.toLowerCase();
    const estimatedDuration = estimateDurationFromTitle(session.title);

    const match = strava.find((a) => {
      const activityDate = new Date(a.start_date).toISOString().slice(0, 10);
      const activitySport = a.sport_type?.toLowerCase();

      const matched =
        activityDate === sessionDate &&
        activitySport === sessionSport &&
        isDurationSimilar(estimatedDuration, a.moving_time);

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
