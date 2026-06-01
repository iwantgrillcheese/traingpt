import type { SessionRow, StravaActivityRow } from '../types';
import { normalizeSport } from './training';

function dateOnly(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function normalizeStravaSport(value?: string | null) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('ride') || text.includes('bike')) return 'Bike';
  if (text.includes('run')) return 'Run';
  if (text.includes('swim')) return 'Swim';
  return 'Other';
}

export function sessionHasSameDayStravaMatch(session: SessionRow, activities: StravaActivityRow[]) {
  const sessionDate = dateOnly(session.date);
  const sessionSport = normalizeSport(session.sport);
  if (!sessionDate || sessionSport === 'Rest') return false;

  return activities.some((activity) => {
    const activityDate = dateOnly(activity.start_date_local ?? activity.start_date);
    const activitySport = normalizeStravaSport(activity.sport_type);
    return activityDate === sessionDate && activitySport === sessionSport;
  });
}
