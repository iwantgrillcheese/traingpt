// utils/mergeSessionWithStrava.ts
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

/**
 * Merges planned sessions with Strava activities. Strava activities that fall outside
 * of the training plan window (before planStartDate) are included as standalone sessions.
 */
export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[],
  planStartDate: string // ISO date string
): (Session & { stravaActivity?: StravaActivity })[] {
  const enrichedSessions: (Session & { stravaActivity?: StravaActivity })[] = [];

  for (const session of sessions) {
    const match = strava.find(
      (a) => a.date === session.date && a.sport === session.sport
    );

    enrichedSessions.push({
      ...session,
      stravaActivity: match ?? undefined,
    });
  }

  // Include extra Strava activities that are *before* the plan start
  const extraStrava = strava.filter((a) => a.date < planStartDate);
  const standalone: (Session & { stravaActivity: StravaActivity })[] = extraStrava.map((activity) => ({
    id: `strava-${activity.id}`,
    user_id: activity.user_id,
    date: activity.date,
    sport: activity.sport,
    title: `📈 ${activity.sport}: ${activity.distance_km?.toFixed(1)}km`,
    details: null,
    text: '',
    structured_workout: null,
    strava_id: activity.id,
    stravaActivity: activity,
  }));

  return [...enrichedSessions, ...standalone];
}
