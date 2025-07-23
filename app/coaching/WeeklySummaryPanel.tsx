'use client';

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { parseISO, subDays, isAfter, isSameDay } from 'date-fns';

type Props = {
  sessions: Session[];
  completedSessions: Session[];
  stravaActivities?: StravaActivity[];
};

export default function WeeklySummaryPanel({
  sessions,
  completedSessions,
  stravaActivities = [],
}: Props) {
  const today = new Date();
  const weekAgo = subDays(today, 6);

  const isWithinWeek = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isAfter(date, weekAgo) || isSameDay(date, weekAgo);
  };

  const planned = sessions.filter((s) => isWithinWeek(s.date)).length;
  const completed =
    completedSessions.filter((s) => isWithinWeek(s.date)).length +
    stravaActivities.filter((a) => isWithinWeek(a.start_date)).length;

  const adherence =
    planned > 0 ? Math.round((completed / planned) * 100) : 0;

  const summary =
    planned === 0
      ? "No sessions planned — likely a rest or taper week."
      : adherence >= 100
      ? "Crushed it! 100% completion. You nailed every session this week. 🔥"
      : adherence >= 80
      ? "Strong consistency — you completed most of your plan. Keep the momentum!"
      : adherence >= 60
      ? "Decent week, but there’s room to improve. Let’s refocus next week. 💪"
      : "Low adherence this week. Life happens — let’s reset and refocus. 🚀";

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">🧠 Weekly Summary</h2>
      <p className="mt-4 text-sm text-gray-700">{summary}</p>
    </div>
  );
}
