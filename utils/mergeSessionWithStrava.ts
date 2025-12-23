import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';

export type MergedSession = Omit<Session, 'duration'> & {
  stravaActivity?: StravaActivity;
  duration?: number; // minutes
  distance_km?: number;
};

export type MergedResult = {
  merged: MergedSession[];
  unmatched: StravaActivity[];
  matchedStravaIds: Set<string>;
};

function stravaKey(a: StravaActivity): string {
  // Prefer Strava activity id, fall back to DB row id
  return String(a.strava_id ?? a.id);
}

function normalizeSessionSport(sport?: Session['sport'] | string): 'swim' | 'bike' | 'run' | null {
  const s = (sport ?? '').toLowerCase();
  if (s.includes('swim')) return 'swim';
  if (s.includes('bike') || s.includes('ride')) return 'bike';
  if (s.includes('run')) return 'run';
  return null;
}

function normalizeStravaSport(sportType?: StravaActivity['sport_type'] | string): 'swim' | 'bike' | 'run' | null {
  const s = (sportType ?? '').toLowerCase();
  if (s.includes('swim')) return 'swim';
  if (s.includes('ride') || s.includes('bike')) return 'bike';
  if (s.includes('run')) return 'run';
  return null;
}

function isDurationSimilar(estimatedMinutes: number | null, stravaSeconds: number): boolean {
  if (!estimatedMinutes) return true; // permissive if we can't estimate
  const stravaMinutes = stravaSeconds / 60;
  const diff = Math.abs(stravaMinutes - estimatedMinutes);
  return diff / estimatedMinutes <= 0.2; // within 20%
}

export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[],
  userTimezone: string = 'America/Los_Angeles'
): MergedResult {
  const matchedIds = new Set<string>();

  // Ensure local_date exists on each activity (timezone-safe date matching)
  const withLocalDate: StravaActivity[] = (() => {
    const needsLocal = strava.some((a) => !a.local_date);
    if (!needsLocal) return strava;
    const grouped = normalizeStravaActivities(strava, userTimezone);
    return Object.values(grouped).flat();
  })();

  const merged: MergedSession[] = sessions.map((session) => {
    const sessionDate = session.date; // 'YYYY-MM-DD'
    const sessionSport = normalizeSessionSport(session.sport);
    const estimatedDuration = estimateDurationFromTitle(session.title);

    if (!sessionDate || !sessionSport) {
      return { ...session };
    }

    const match = withLocalDate.find((a) => {
      const key = stravaKey(a);
      if (matchedIds.has(key)) return false;

      const activityDate = a.local_date ?? String(a.start_date).slice(0, 10);
      const activitySport = normalizeStravaSport(a.sport_type);
      if (!activitySport) return false;

      const ok =
        activityDate === sessionDate &&
        activitySport === sessionSport &&
        isDurationSimilar(estimatedDuration, a.moving_time);

      if (ok) matchedIds.add(key);
      return ok;
    });

    return {
      ...session,
      stravaActivity: match,
      duration: match?.moving_time ? match.moving_time / 60 : undefined,
      distance_km: match?.distance ? match.distance / 1000 : undefined,
    };
  });

  const unmatched = withLocalDate.filter((a) => !matchedIds.has(stravaKey(a)));

  return { merged, unmatched, matchedStravaIds: matchedIds };
}
