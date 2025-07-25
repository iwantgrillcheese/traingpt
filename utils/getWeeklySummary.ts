import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import {
  startOfWeek,
  parseISO,
  isBefore,
  isEqual,
  isAfter,
} from 'date-fns';

export type WeeklySummary = {
  totalPlanned: number;
  totalCompleted: number;
  sportBreakdown: {
    sport: string;
    planned: number;
    completed: number;
  }[];
  adherence: number;
  planToDate: {
    planned: number;
    completed: number;
    adherence: number;
  };
  trend?: number;
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
    case 'strength':
      return 'Strength';
    default:
      return 'Other';
  }
};

export function getWeeklySummary(
  sessions: Session[],
  completedSessions: Session[],
  stravaActivities: StravaActivity[] = [],
  previousWeekAdherence?: number,
  planStartDate?: string
): WeeklySummary {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const isInWeekToDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return d >= weekStart && (isBefore(d, today) || isEqual(d, today));
  };

  const plannedThisWeek = sessions.filter((s) => isInWeekToDate(s.date));
  const completedThisWeek = [...completedSessions, ...stravaActivities].filter((s) =>
    isInWeekToDate('start_date' in s ? s.start_date : s.date)
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

  // ----- PLAN-TO-DATE COMPLIANCE -----
  const planStart = planStartDate ? parseISO(planStartDate) : null;

  const isInPlanToDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return planStart && (isAfter(d, planStart) || isEqual(d, planStart)) && (isBefore(d, today) || isEqual(d, today));
  };

  const plannedToDate = planStart
    ? sessions.filter((s) => isInPlanToDate(s.date))
    : [];
  const completedToDate = planStart
    ? [...completedSessions, ...stravaActivities].filter((s) =>
        isInPlanToDate('start_date' in s ? s.start_date : s.date)
      )
    : [];

  const planPlannedCount = plannedToDate.length;
  const planCompletedCount = completedToDate.length;
  const planAdherence =
    planPlannedCount > 0 ? Math.round((planCompletedCount / planPlannedCount) * 100) : 0;

  // ----- TREND -----
  const trend = previousWeekAdherence !== undefined ? adherence - previousWeekAdherence : undefined;

  return {
    totalPlanned,
    totalCompleted,
    sportBreakdown,
    adherence,
    trend,
    planToDate: {
      planned: planPlannedCount,
      completed: planCompletedCount,
      adherence: planAdherence,
    },
    debug: {
      plannedSessionsCount: plannedThisWeek.length,
      completedSessionsCount: completedThisWeek.length,
      stravaCount: stravaActivities.length,
      rawPlanned: plannedThisWeek,
      rawCompleted: completedThisWeek,
    },
  };
}
