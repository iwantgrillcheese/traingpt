import type { Session } from './session';
import type { StravaActivity } from './strava';

// Used for calendar rendering (e.g. with Strava overlay)
export type EnrichedSession = Session & {
  stravaActivity?: StravaActivity;
};
