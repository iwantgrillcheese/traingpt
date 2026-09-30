'use client';

import { format, isToday, parseISO } from 'date-fns';
import { useMemo } from 'react';
import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import CalendarWorkoutCard from './CalendarWorkoutCard';

type Props = {
  currentMonth: Date;
  sessionsByDate: Record<string, MergedSession[]>;
  stravaByDate: Record<string, StravaActivity[]>;
  completedSessions: CompletedSession[];
  onSessionClick: (session: MergedSession) => void;
  onStravaActivityClick: (activity: StravaActivity) => void;
  onAddSessionClick: (date: Date) => void;
};

export default function MonthAgenda({ currentMonth, sessionsByDate, stravaByDate, completedSessions, onSessionClick, onStravaActivityClick, onAddSessionClick }: Props) {
  const days = useMemo(() => {
    const prefix = format(currentMonth, 'yyyy-MM') + '-';
    return [...new Set([...Object.keys(sessionsByDate), ...Object.keys(stravaByDate)])]
      .filter(key => key.startsWith(prefix) && ((sessionsByDate[key]?.length ?? 0) + (stravaByDate[key]?.length ?? 0) > 0))
      .sort();
  }, [currentMonth, sessionsByDate, stravaByDate]);

  if (!days.length) return <div className="rounded-2xl border border-[#E3E0D8] bg-white px-5 py-10 text-center"><p className="text-sm font-semibold">No workouts this month.</p><p className="mt-2 text-sm text-[#6B7280]">Choose another month or add a session.</p></div>;

  return (
    <section aria-label="Monthly training agenda" className="divide-y divide-[#E3E0D8] rounded-2xl border border-[#E3E0D8] bg-white px-4">
      {days.map(key => {
        const date = parseISO(key);
        return (
          <section key={key} aria-label={format(date, 'EEEE, MMMM d')} className="py-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><time dateTime={key}>{format(date, 'EEE, MMM d')}</time>{isToday(date) ? <span className="rounded-full bg-[#101114] px-2 py-0.5 text-[10px] font-medium text-white">Today</span> : null}</h3>
              <button type="button" aria-label={`Add session on ${format(date, 'MMMM d')}`} onClick={() => onAddSessionClick(date)} className="rounded-lg px-2 py-1 text-lg text-[#6B7280] hover:bg-[#F7F6F2]">+</button>
            </div>
            <div className="space-y-2">
              {(sessionsByDate[key] ?? []).map(session => <CalendarWorkoutCard key={session.id} session={session} completedSessions={completedSessions} onClick={() => onSessionClick(session)} />)}
              {(stravaByDate[key] ?? []).map(activity => <CalendarWorkoutCard key={`strava-${activity.strava_id ?? activity.id}`} activity={activity} completedSessions={completedSessions} onClick={() => onStravaActivityClick(activity)} />)}
            </div>
          </section>
        );
      })}
    </section>
  );
}
