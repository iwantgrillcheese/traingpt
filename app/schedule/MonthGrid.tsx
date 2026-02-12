'use client';

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  format,
  isToday,
} from 'date-fns';
import { useMemo } from 'react';
import clsx from 'clsx';
import DayCell from './DayCell';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type MonthGridProps = {
  currentMonth: Date;
  sessionsByDate: Record<string, MergedSession[]>;
  completedSessions: CompletedSession[];
  stravaByDate: Record<string, StravaActivity[]>;
  onSessionClick?: (session: MergedSession) => void;
  onStravaActivityClick?: (activity: StravaActivity) => void;
  onSessionAdded?: (newSession: any) => void;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  completedSessions,
  stravaByDate,
  onSessionClick,
  onStravaActivityClick,
  onSessionAdded,
}: MonthGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const arr: Date[] = [];
    let d = start;
    while (d <= end) {
      arr.push(d);
      d = addDays(d, 1);
    }
    return arr;
  }, [currentMonth]);

  return (
    <div className="w-full min-w-[1450px]">
      <div
        className={clsx(
          'overflow-hidden rounded-2xl border border-black/10 bg-zinc-100/60',
          'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
        )}
      >
        <div className="grid grid-cols-7 border-b border-black/10 bg-zinc-100">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-600"
            >
              {d}
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-7"
          style={{
            gridAutoRows: 'minmax(220px, 1fr)',
          }}
        >
          {days.map((dateObj, idx) => {
            const dayKey = format(dateObj, 'yyyy-MM-dd');
            const outside = !isSameMonth(dateObj, currentMonth);
            const today = isToday(dateObj);

            const col = idx % 7;
            const row = Math.floor(idx / 7);

            const showLeft = col !== 0;
            const showTop = row !== 0;

            return (
              <div
                key={dayKey}
                className={clsx(
                  showLeft && 'border-l border-black/10',
                  showTop && 'border-t border-black/10',
                  outside ? 'bg-zinc-50/70' : 'bg-zinc-50/20',
                  today && 'bg-white',
                  'transition-colors hover:bg-white/80'
                )}
              >
                <DayCell
                  date={dateObj}
                  sessions={sessionsByDate?.[dayKey] ?? []}
                  isOutside={outside}
                  completedSessions={completedSessions}
                  extraActivities={stravaByDate?.[dayKey] ?? []}
                  onSessionClick={onSessionClick}
                  onStravaActivityClick={onStravaActivityClick}
                  onSessionAdded={onSessionAdded}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-zinc-500">
        Drag sessions to reschedule. Click a session for details.
      </div>
    </div>
  );
}
