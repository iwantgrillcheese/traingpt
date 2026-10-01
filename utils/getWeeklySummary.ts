import { dateIsPaused, type TrainingPause } from './trainingPause';
import { sessionIsComplete, type CompletionRecord } from './sessionCompletion';
// utils/getWeeklySummary.ts

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  addDays,
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
    rawCompleted: any[];
  };
};

const normalizeSportLabel = (input: string | null | undefined): string => {
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

function safeParseISO(s?: string | null): Date | null {
  if (!s) return null;
  try {
    return parseISO(s);
  } catch {
    return null;
  }
}

function getSessionMinutesFromPlanned(s: Session): number {
  const raw = s.duration;
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw);
  return estimateDurationFromTitle(s.title ?? '');
}

function getMinutesFromStrava(a: StravaActivity): number {
  const mt = a.moving_time;
  if (mt != null && Number.isFinite(Number(mt))) return Number(mt) / 60;
  return 0;
}

export function getWeeklySummary(
  sessions: Session[], completedSessions: CompletionRecord[], stravaActivities: StravaActivity[] = [], pauses: TrainingPause[] = []
): WeeklySummary {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekEnd, -7);
  const inWindow = (session: Session, start: Date, end: Date) => {
    const date = safeParseISO(session.date);
    return !!date && isWithinInterval(date, { start, end });
  };
  const { merged } = mergeSessionsWithStrava(sessions.filter(session => !dateIsPaused(session.date, pauses)), stravaActivities, 'America/Los_Angeles', completedSessions);
  const completed = (session: Session) => sessionIsComplete(session, completedSessions);
  // Attribute adherence to planned dates. Include future sessions already done,
  // while future uncompleted sessions are not yet obligations.
  const due = (session: Session) => parseISO(session.date) <= now || completed(session);
  const weekly = merged.filter(session => inWindow(session, weekStart, weekEnd) && due(session));
  const all = merged.filter(due);
  const last = merged.filter(session => inWindow(session, lastWeekStart, lastWeekEnd));
  const stats = (rows: typeof merged) => {
    const plannedMinutes = rows.reduce((sum, row) => sum + getSessionMinutesFromPlanned(row), 0);
    const done = rows.filter(completed);
    const minutes = done.reduce((sum, row) => sum + (row.stravaActivity ? getMinutesFromStrava(row.stravaActivity) : getSessionMinutesFromPlanned(row)), 0);
    return { planned: rows.length, completed: done.length,
      adherence: Math.max(0, Math.min(100, Math.round(plannedMinutes ? minutes / plannedMinutes * 100 : rows.length ? done.length / rows.length * 100 : 0))) };
  };
  const weeklyStats = stats(weekly);
  const sportMap = new Map<string, { planned: number; completed: number }>();
  for (const session of weekly) {
    const sport = normalizeSportLabel(session.sport);
    const counts = sportMap.get(sport) ?? { planned: 0, completed: 0 };
    counts.planned += 1; if (completed(session)) counts.completed += 1;
    sportMap.set(sport, counts);
  }
  return { totalPlanned: weeklyStats.planned, totalCompleted: weeklyStats.completed,
    adherence: weeklyStats.adherence, sportBreakdown: Array.from(sportMap, ([sport, counts]) => ({ sport, ...counts })),
    planToDate: stats(all), trend: weeklyStats.adherence - stats(last).adherence,
    debug: { plannedSessionsCount: weekly.length, completedSessionsCount: weeklyStats.completed,
      stravaCount: stravaActivities.length, rawPlanned: weekly, rawCompleted: completedSessions } };
}
