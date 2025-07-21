// utils/mergeSessionsWithStrava.ts
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): (Session & { stravaActivity?: StravaActivity })[] {
  const enriched: (Session & { stravaActivity?: StravaActivity })[] = [];
  const matchedStravaIds = new Set<string>();

  for (const session of sessions) {
    if (!session.date || !session.sport) continue;

    const match = strava.find(
      (a) => a.date === session.date && a.sport.toLowerCase() === session.sport.toLowerCase()
    );

    if (match) matchedStravaIds.add(match.id);

    enriched.push({
      ...session,
      stravaActivity: match ?? undefined,
    });
  }

  const unmatchedStrava = strava
    .filter((a) => a.date && a.sport && !matchedStravaIds.has(a.id))
    .map((a) => ({
      id: `strava-${a.id}`,
      user_id: a.user_id,
      date: a.date,
      sport: a.sport,
      title: `${a.sport}: ${a.distance_km?.toFixed(1)}km`,
      details: null,
      text: '',
      structured_workout: null,
      strava_id: a.id,
      stravaActivity: a,
    }));

  return [...enriched, ...unmatchedStrava];
}
