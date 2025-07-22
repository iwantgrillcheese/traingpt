import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { format, parseISO } from 'date-fns';

export type WeeklyComparison = {
  date: string;
  swim?: number;
  bike?: number;
  run?: number;

  // new fields required by buildWeeklyCoachPrompt
  sport?: string;
  title?: string;
  status?: string;
  actualDuration?: number;
  paceDelta?: number;
  powerDelta?: number;
};


export function buildWeeklyComparison(
  sessions: Session[],
  stravaActivities: StravaActivity[],
  baseline: {
    bike_ftp?: number;
    run_threshold?: number;
    swim_css?: number;
    pace_units: 'mile' | 'km';
  }
): WeeklyComparison[] {
  const weeks: Record<string, WeeklyComparison> = {};

  // Process planned sessions
  for (const session of sessions) {
    const dateKey = format(parseISO(session.date), 'yyyy-MM-dd');
    if (!weeks[dateKey]) weeks[dateKey] = { date: dateKey };

    switch (session.sport) {
      case 'Swim':
        weeks[dateKey].swim = (weeks[dateKey].swim || 0) + 1;
        break;
      case 'Bike':
        weeks[dateKey].bike = (weeks[dateKey].bike || 0) + 1;
        break;
      case 'Run':
        weeks[dateKey].run = (weeks[dateKey].run || 0) + 1;
        break;
    }
  }

  // Process Strava activities
  for (const activity of stravaActivities) {
    const dateKey = format(parseISO(activity.date), 'yyyy-MM-dd');
    if (!weeks[dateKey]) weeks[dateKey] = { date: dateKey };

    switch (activity.sport) {
      case 'Swim':
        weeks[dateKey].swim = (weeks[dateKey].swim || 0) + 1;
        break;
      case 'Bike':
        weeks[dateKey].bike = (weeks[dateKey].bike || 0) + 1;
        break;
      case 'Run':
        weeks[dateKey].run = (weeks[dateKey].run || 0) + 1;
        break;
    }
  }

  return Object.values(weeks);
}
