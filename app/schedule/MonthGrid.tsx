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

  const totalCells = days.length; // typically 35 or 42
  const cols = 7;
  const rows = Math.ceil(totalCells / cols);

  return (
    <div className="w-full">
      {/* Outer frame: TP-ish (flat, table-like) */}
      <div
        className={clsx(
          'overflow-hidden',
          'rounded-xl border border-black/10 bg-white',
          'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
        )}
      >
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-black/10 bg-zinc-50">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-600"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          className="grid grid-cols-7"
          style={{
            // makes rows feel consistent / “table” like TP
            gridAutoRows: 'minmax(180px, 1fr)',
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
                  // borders: single-pixel grid with no double edges
                  showLeft && 'border-l border-black/10',
                  showTop && 'border-t border-black/10',
                  // backgrounds
                  outside ? 'bg-zinc-50/60' : 'bg-white',
                  today && 'bg-zinc-50',
                  // subtle hover to mimic “interactive calendar”
                  'transition-colors hover:bg-black/[0.015]'
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

        {/* Optional: tiny footer strip to mimic TP’s “end of grid” subtle edge */}
        <div className="h-2 bg-white" />
      </div>

      {/* Micro caption like TP (optional) */}
      <div className="mt-2 text-[11px] text-zinc-500">
        Drag sessions to reschedule. Click a session for details.
      </div>
    </div>
  );
}
