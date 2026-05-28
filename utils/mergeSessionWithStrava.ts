import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';

export type MergedSession = Omit<Session, 'duration'> & {
  stravaActivity?: StravaActivity;
  duration?: number; // completed activity duration in minutes
  distance_km?: number;
};

export type MergedResult = {
  merged: MergedSession[];
  unmatched: StravaActivity[];
  matchedStravaIds: Set<string>;
};

type NormalizedSport = 'swim' | 'bike' | 'run';

function stravaKey(activity: StravaActivity): string {
  return String(activity.strava_id ?? activity.id);
}

function normalizeSessionSport(sport?: Session['sport'] | string): NormalizedSport | null {
  const normalized = String(sport ?? '').toLowerCase();

  if (normalized.includes('swim')) return 'swim';
  if (normalized.includes('bike') || normalized.includes('ride') || normalized.includes('cycle')) return 'bike';
  if (normalized.includes('run')) return 'run';

  return null;
}

function normalizeStravaSport(sportType?: StravaActivity['sport_type'] | string): NormalizedSport | null {
  const normalized = String(sportType ?? '').toLowerCase();

  if (normalized.includes('swim')) return 'swim';
  if (normalized.includes('ride') || normalized.includes('bike') || normalized.includes('virtualride')) return 'bike';
  if (normalized.includes('run')) return 'run';

  return null;
}

function getActivityDate(activity: StravaActivity): string | null {
  return activity.local_date ?? activity.start_date_local?.slice(0, 10) ?? activity.start_date?.slice(0, 10) ?? null;
}

function getActivityDurationMinutes(activity: StravaActivity): number | null {
  const seconds = Number(activity.moving_time ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return seconds / 60;
}

function durationScore(estimatedMinutes: number | null, activity: StravaActivity): number {
  if (!estimatedMinutes || estimatedMinutes <= 0) return 0;

  const actualMinutes = getActivityDurationMinutes(activity);
  if (!actualMinutes) return Number.MAX_SAFE_INTEGER;

  return Math.abs(actualMinutes - estimatedMinutes) / estimatedMinutes;
}

function isDurationAcceptable(estimatedMinutes: number | null, activity: StravaActivity): boolean {
  if (!estimatedMinutes || estimatedMinutes <= 0) return true;

  const score = durationScore(estimatedMinutes, activity);

  // Be a little forgiving. Real workouts can be extended, cut short, or logged with
  // warmup/cooldown that the plan title did not capture.
  return score <= 0.35;
}

function bucketKey(date: string, sport: NormalizedSport) {
  return `${date}::${sport}`;
}

export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[],
  userTimezone: string = 'America/Los_Angeles'
): MergedResult {
  const matchedIds = new Set<string>();

  const groupedByDate = normalizeStravaActivities(strava, userTimezone);
  const normalizedActivities = Object.values(groupedByDate).flat();

  const activitiesByDateAndSport = normalizedActivities.reduce<Record<string, StravaActivity[]>>(
    (acc, activity) => {
      const date = getActivityDate(activity);
      const sport = normalizeStravaSport(activity.sport_type);

      if (!date || !sport) return acc;

      const key = bucketKey(date, sport);
      if (!acc[key]) acc[key] = [];
      acc[key].push(activity);

      return acc;
    },
    {}
  );

  const merged: MergedSession[] = sessions.map((session) => {
    const sessionDate = session.date;
    const sessionSport = normalizeSessionSport(session.sport);

    if (!sessionDate || !sessionSport) {
      return { ...session };
    }

    const estimatedDuration = estimateDurationFromTitle(session.title);
    const candidates = activitiesByDateAndSport[bucketKey(sessionDate, sessionSport)] ?? [];

    const bestMatch =
      candidates
        .filter((activity) => !matchedIds.has(stravaKey(activity)))
        .filter((activity) => isDurationAcceptable(estimatedDuration, activity))
        .sort((a, b) => durationScore(estimatedDuration, a) - durationScore(estimatedDuration, b))[0] ?? null;

    if (!bestMatch) {
      return { ...session };
    }

    matchedIds.add(stravaKey(bestMatch));

    const durationMinutes = getActivityDurationMinutes(bestMatch);
    const distanceMeters = Number(bestMatch.distance ?? 0);

    return {
      ...session,
      stravaActivity: bestMatch,
      duration: durationMinutes ?? undefined,
      distance_km: Number.isFinite(distanceMeters) && distanceMeters > 0 ? distanceMeters / 1000 : undefined,
    };
  });

  const unmatched = normalizedActivities.filter((activity) => !matchedIds.has(stravaKey(activity)));

  return { merged, unmatched, matchedStravaIds: matchedIds };
}
