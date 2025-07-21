import { parseISO, isSameDay } from 'date-fns';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

export default function mergeSessionsWithStrava(
  sessions: Session[],
  strava: StravaActivity[]
): (Session & { stravaActivity?: StravaActivity })[] {
  return sessions.map((session) => {
    const sessionDate = parseISO(session.date);

    const match = strava.find(
      (activity) =>
        activity.date &&
        activity.sport &&
        isSameDay(parseISO(activity.date), sessionDate) &&
        activity.sport.toLowerCase() === session.sport.toLowerCase()
    );

    return {
      ...session,
      stravaActivity: match || undefined,
    };
  });
}
