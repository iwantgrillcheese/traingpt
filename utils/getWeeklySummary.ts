import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';

export type WeeklySummary = {
  totalPlanned: number;
  totalCompleted: number;
  sportBreakdown: {
    sport: string;
    planned: number;
    completed: number;
  }[];
  adherence: number;
};

const normalizeSport = (input: string | null | undefined): string => {
  const sport = input?.toLowerCase();
  switch (sport) {
    case 'swim':
      return 'Swim';
    case 'bike':
    case 'ride':
    case 'virtualride':
      return 'Bike';
    case 'run':
      return 'Run';
    default:
      return 'Other';
  }
};

export function getWeeklySummary(
  sessions: Session[],
  completedSessions: Session[],
  stravaActivities: StravaActivity[] = []
): WeeklySummary {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const isInLast7Days = (dateStr: string) => {
    const d = new Date(dateStr);
    return d >= sevenDaysAgo && d <= now;
  };

  const plannedLast7 = sessions.filter((s) => isInLast7Days(s.date));
  const completedLast7 = [...completedSessions, ...stravaActivities].filter((s) =>
    isInLast7Days('start_date' in s ? s.start_date : s.date)
  );

  const plannedDurationsBySport: Record<string, number> = {};
  const completedDurationsBySport: Record<string, number> = {};

  plannedLast7.forEach((s) => {
    const sport = normalizeSport(s.sport ?? '');
    const duration = typeof s.duration === 'number' ? s.duration : 0;
    plannedDurationsBySport[sport] = (plannedDurationsBySport[sport] || 0) + duration;
  });

  completedLast7.forEach((s) => {
    const sport = normalizeSport('sport_type' in s ? s.sport_type : s.sport ?? '');
    const duration =
      'moving_time' in s ? s.moving_time / 60 : typeof s.duration === 'number' ? s.duration : 0;
    completedDurationsBySport[sport] = (completedDurationsBySport[sport] || 0) + duration;
  });

  const allSports = ['Swim', 'Bike', 'Run'];
  const sportBreakdown = allSports.map((sport) => ({
    sport,
    planned: plannedDurationsBySport[sport] ?? 0,
    completed: completedDurationsBySport[sport] ?? 0,
  }));

  const totalPlanned = sportBreakdown.reduce((sum, x) => sum + x.planned, 0);
  const totalCompleted = sportBreakdown.reduce((sum, x) => sum + x.completed, 0);
  const adherence = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

  return {
    totalPlanned,
    totalCompleted,
    sportBreakdown,
    adherence,
  };
}
