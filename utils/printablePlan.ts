import type { GeneratedPlan } from '@/types/plan';
import type { Session } from '@/types/session';

export function printableWeeks(plan: GeneratedPlan, sessions: Session[]) {
  const weeks = (plan.weeks ?? []).map((week, index) => {
    const end = new Date(week.startDate + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() + 6);
    const endDate = end.toISOString().slice(0, 10);
    return { number: index + 1, phase: week.phase, startDate: week.startDate, endDate,
      sessions: sessions.filter(session => session.date >= week.startDate && session.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date) || a.sport.localeCompare(b.sport)) };
  });
  // A moved workout can extend beyond the originally generated horizon.
  // Keep it printable rather than silently omitting persisted training.
  for (const session of sessions) {
    if (weeks.some(week => session.date >= week.startDate && session.date <= week.endDate)) continue;
    const start = new Date(session.date + 'T12:00:00Z');
    if (!Number.isFinite(start.getTime())) continue;
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10);
    weeks.push({ number: 0, phase: 'Rescheduled', startDate, endDate,
      sessions: sessions.filter(row => row.date >= startDate && row.date <= endDate)
        .sort((a,b) => a.date.localeCompare(b.date) || a.sport.localeCompare(b.sport)) });
  }
  return weeks.sort((a,b) => a.startDate.localeCompare(b.startDate)).map((week,index) => ({ ...week, number: index + 1 }));
}
