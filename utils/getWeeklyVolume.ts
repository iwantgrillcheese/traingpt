import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { parseISO, startOfWeek, addWeeks, isWithinInterval } from 'date-fns';

export function getWeeklyVolume(
  sessions: Session[],
  completedSessions: Session[],
  stravaActivities: StravaActivity[] = [],
  weeksBack = 4
): number[] {
  const result: number[] = [];
  const now = new Date();
  const baseStart = startOfWeek(addWeeks(now, -weeksBack + 1), { weekStartsOn: 1 });

  for (let i = 0; i < weeksBack; i++) {
    const start = addWeeks(baseStart, i);
    const end = addWeeks(start, 1);

    const allSources = [...sessions, ...completedSessions];
    const relevantSessions = allSources.filter((s) =>
      isWithinInterval(parseISO(s.date), { start, end })
    );

    const sessionMins = relevantSessions.reduce((total, s) => {
      return total + (s.duration ?? estimateDurationFromTitle(s.title));
    }, 0);

    const stravaMins = stravaActivities
      .filter((a) => isWithinInterval(parseISO(a.start_date), { start, end }))
      .reduce((total, a) => total + a.moving_time / 60, 0);

    const totalHours = (sessionMins + stravaMins) / 60;
    result.push(Math.round(totalHours * 10) / 10); // round to 1 decimal
  }

  return result;
}

function estimateDurationFromTitle(title?: string | null): number {
  if (!title) return 45;
  const match = title.match(/(\d{2,3})\s*min/i);
  return match ? parseInt(match[1], 10) : 45;
}
