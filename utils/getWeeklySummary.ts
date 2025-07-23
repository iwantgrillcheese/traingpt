import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { parseISO, isAfter, isSameDay, subDays, startOfDay } from 'date-fns';

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
  const today = startOfDay(new Date());
  const weekAgo = subDays(today, 6); // last 7 days including today

  const summaryMap: Record<string, { planned: number; completed: number }> = {
    Swim: { planned: 0, completed: 0 },
    Bike: { planned: 0, completed: 0 },
    Run: { planned: 0, completed: 0 },
    Strength: { planned: 0, completed: 0 },
  };

  const isWithinWeek = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isAfter(date, weekAgo) || isSameDay(date, weekAgo);
  };

  for (const s of sessions) {
    if (isWithinWeek(s.date)) {
      const sport = normalizeSport(s.sport);
      if (!summaryMap[sport]) summaryMap[sport] = { planned: 0, completed: 0 };
      summaryMap[sport].planned++;
    }
  }

  for (const c of completedSessions) {
    if (isWithinWeek(c.date)) {
      const sport = normalizeSport(c.sport);
      if (!summaryMap[sport]) summaryMap[sport] = { planned: 0, completed: 0 };
      summaryMap[sport].completed++;
    }
  }

  for (const a of stravaActivities) {
    if (isWithinWeek(a.start_date)) {
      const sport = normalizeSport(a.sport_type);
      if (!summaryMap[sport]) summaryMap[sport] = { planned: 0, completed: 0 };
      summaryMap[sport].completed++;
    }
  }

  const sportBreakdown = Object.entries(summaryMap).map(([sport, data]) => ({
    sport,
    planned: data.planned,
    completed: data.completed,
  }));

  const totalPlanned = sportBreakdown.reduce((sum, s) => sum + s.planned, 0);
  const totalCompleted = sportBreakdown.reduce((sum, s) => sum + s.completed, 0);
  const adherence =
    totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

  return {
    totalPlanned,
    totalCompleted,
    sportBreakdown,
    adherence,
  };
}
