// /utils/getWeeklySummary.ts
import { Session } from '@/types/session';
import { parseISO, isAfter, subDays, isSameDay } from 'date-fns';

// This function aggregates total planned and completed volume per sport over the last 7 days
export function getWeeklySummary(
  sessions: Session[],
  completedSessions: Session[]
) {
  const today = new Date();
  const weekAgo = subDays(today, 6); // last 7 days including today

  const summary: Record<
    string,
    { planned: number; completed: number }
  > = {
    Swim: { planned: 0, completed: 0 },
    Bike: { planned: 0, completed: 0 },
    Run: { planned: 0, completed: 0 },
    Strength: { planned: 0, completed: 0 },
  };

  for (const s of sessions) {
    const date = parseISO(s.date);
    if (isAfter(date, weekAgo) || isSameDay(date, weekAgo)) {
      if (summary[s.sport]) {
        summary[s.sport].planned++;
      }
    }
  }

  for (const c of completedSessions) {
    const date = parseISO(c.date);
    if (isAfter(date, weekAgo) || isSameDay(date, weekAgo)) {
      if (summary[c.sport]) {
        summary[c.sport].completed++;
      }
    }
  }

  return summary;
}
