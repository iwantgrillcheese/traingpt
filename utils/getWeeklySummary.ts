import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { startOfWeek, endOfWeek, parseISO } from 'date-fns';

export type WeeklySummary = {
  totalPlanned: number;
  totalCompleted: number;
  sportBreakdown: {
    sport: string;
    planned: number;
    completed: number;
  }[];
  adherence: number;
  debug?: {
    plannedSessionsCount: number;
    completedSessionsCount: number;
    stravaCount: number;
    rawPlanned: any[];
    rawCompleted: any[];
  };
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
  const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday

  const isInThisWeek = (dateStr: string) => {
    const d = parseISO(dateStr);
    return d >= start && d <= end;
  };

  const plannedThisWeek = sessions.filter((s) => isInThisWeek(s.date));
  const completedThisWeek = [...completedSessions, ...stravaActivities].filter((s) =>
    isInThisWeek('start_date' in s ? s.start_date : s.date)
  );

  const plannedDurationsBySport: Record<string, number> = {};
  const completedDurationsBySport: Record<string, number> = {};

  plannedThisWeek.forEach((s) => {
    const sport = normalizeSport(s.sport ?? '');
    const duration = typeof s.duration === 'number' ? s.duration : 0;
    if (duration > 0) {
      plannedDurationsBySport[sport] = (plannedDurationsBySport[sport] || 0) + duration;
    }
  });

  completedThisWeek.forEach((s) => {
    const sport = normalizeSport('sport_type' in s ? s.sport_type : s.sport ?? '');
    const duration =
      'moving_time' in s ? s.moving_time / 60 : typeof s.duration === 'number' ? s.duration : 0;
    if (duration > 0) {
      completedDurationsBySport[sport] = (completedDurationsBySport[sport] || 0) + duration;
    }
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
    debug: {
      plannedSessionsCount: plannedThisWeek.length,
      completedSessionsCount: completedThisWeek.length,
      stravaCount: stravaActivities.length,
      rawPlanned: plannedThisWeek,
      rawCompleted: completedThisWeek,
    },
  };
}
