// utils/getWeeklySummary.ts

import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  isBefore,
  isEqual,
} from 'date-fns';

export type WeeklySummary = {
  totalPlanned: number;
  totalCompleted: number;
  adherence: number;
  sportBreakdown: {
    sport: string;
    planned: number;
    completed: number;
  }[];
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
    rawPlanned: Session[];
    rawCompleted: Session[];
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
  stravaActivities: StravaActivity[] = []
): WeeklySummary {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const isThisWeek = (d: string) =>
    isWithinInterval(parseISO(d), { start: weekStart, end: weekEnd });

  const weeklyPlanned = sessions.filter((s) => isThisWeek(s.date));
  const weeklyCompleted = completedSessions.filter((s) => isThisWeek(s.date));
  const stravaThisWeek = stravaActivities.filter((a) => isThisWeek(a.start_date));

  const sportMap = new Map<string, { planned: number; completed: number }>();

  weeklyPlanned.forEach((s) => {
    const key = normalizeSport(s.sport);
    if (!sportMap.has(key)) sportMap.set(key, { planned: 0, completed: 0 });
    sportMap.get(key)!.planned += 1;
  });
  weeklyCompleted.forEach((s) => {
    const key = normalizeSport(s.sport);
    if (!sportMap.has(key)) sportMap.set(key, { planned: 0, completed: 0 });
    sportMap.get(key)!.completed += 1;
  });

  const breakdown = Array.from(sportMap.entries()).map(([sport, { planned, completed }]) => ({
    sport,
    planned,
    completed,
  }));

  // Week-to-date adherence
  const today = new Date();
  const weekToDatePlanned = weeklyPlanned.filter((s) => {
    const d = parseISO(s.date);
    return isBefore(d, today) || isEqual(d, today);
  });
  const adherence =
    weekToDatePlanned.length > 0
      ? Math.round((weeklyCompleted.length / weekToDatePlanned.length) * 100)
      : 0;

  // Plan-to-date compliance
  const allPlanned = sessions.filter((s) => isBefore(parseISO(s.date), now) || isEqual(parseISO(s.date), now));
  const allCompleted = completedSessions;
  const planAdherence =
    allPlanned.length > 0 ? Math.round((allCompleted.length / allPlanned.length) * 100) : 0;

  return {
    totalPlanned: weeklyPlanned.length,
    totalCompleted: weeklyCompleted.length,
    adherence,
    sportBreakdown: breakdown,
    planToDate: {
      planned: allPlanned.length,
      completed: allCompleted.length,
      adherence: planAdherence,
    },
    trend: undefined, // can be filled by external logic
    debug: {
      plannedSessionsCount: weeklyPlanned.length,
      completedSessionsCount: weeklyCompleted.length,
      stravaCount: stravaThisWeek.length,
      rawPlanned: weeklyPlanned,
      rawCompleted: weeklyCompleted,
    },
  };
}
