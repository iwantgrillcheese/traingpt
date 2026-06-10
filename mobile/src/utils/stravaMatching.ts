// /mobile/src/utils/stravaMatching.ts
//
// Brought in line with the web app's mergeSessionWithStrava semantics:
// same-day + same-sport is no longer enough on its own — when the planned
// session has a duration, the activity's moving time must be within a
// forgiving tolerance, so a 15-minute spin no longer "completes" a 2-hour
// long ride. Strength activities (weight training / crossfit) now match too.

import type { SessionRow, StravaActivityRow } from '../types';
import { normalizeSport } from './training';

// Forgiving by design: real workouts get extended, cut short, or logged with
// warmup/cooldown the plan title did not capture. Mirrors web behavior.
const DURATION_TOLERANCE = 0.6;

function dateOnly(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function normalizeStravaSport(value?: string | null) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('ride') || text.includes('bike')) return 'Bike';
  if (text.includes('run')) return 'Run';
  if (text.includes('swim')) return 'Swim';
  if (text.includes('weight') || text.includes('crossfit') || text.includes('workout')) return 'Strength';
  return 'Other';
}

function activityMinutes(activity: StravaActivityRow) {
  const seconds = Number(activity.moving_time ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds / 60;
}

export function sessionHasSameDayStravaMatch(session: SessionRow, activities: StravaActivityRow[]) {
  const sessionDate = dateOnly(session.date);
  const sessionSport = normalizeSport(session.sport);
  if (!sessionDate || sessionSport === 'Rest') return false;

  const plannedMinutes = Number(session.duration ?? 0);

  return activities.some((activity) => {
    const activityDate = dateOnly(activity.start_date_local ?? activity.start_date);
    if (activityDate !== sessionDate) return false;

    const activitySport = normalizeStravaSport(activity.sport_type);
    if (activitySport !== sessionSport) return false;

    // No planned duration -> same day + sport is the best signal we have.
    if (!Number.isFinite(plannedMinutes) || plannedMinutes <= 0) return true;

    const actualMinutes = activityMinutes(activity);
    // Missing moving time -> stay lenient rather than un-complete sessions.
    if (!actualMinutes) return true;

    return Math.abs(actualMinutes - plannedMinutes) / plannedMinutes <= DURATION_TOLERANCE;
  });
}
