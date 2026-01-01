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
  onSessionAdded?: (newSession: any) => void;
};

function weekLabel(weekStart: Date) {
  // ISO week number
  return `Week ${format(weekStart, 'I')}`;
}

function weekRangeLabel(week: Date[]) {
  const a = week[0];
  const b = week[6];
  return `${format(a, 'MMM d')}–${format(b, 'MMM d')}`;
}

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  completedSessions,
  stravaByDate,
  onSessionClick,
  onSessionAdded,
}: MonthGridProps) {
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const days: Date[] = [];
    let d = start;
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }

    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [currentMonth]);

  return (
    <div className="w-full">
      {/* Header row */}
      <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))] items-center text-xs text-gray-500">
        <div className="px-3 py-2 border-b border-gray-200 bg-white sticky left-0 z-10">
          Week
        </div>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-3 py-2 border-b border-gray-200 text-center bg-white">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {weeks.map((week, idx) => {
          const wkStart = week[0];

          // Hide weeks that are fully outside the month
          const isAllOutside = week.every((d) => !isSameMonth(d, currentMonth));
          if (isAllOutside) return null;

          const plannedCount = week.reduce((acc, d) => {
            const k = format(d, 'yyyy-MM-dd');
            return acc + (sessionsByDate[k]?.length ?? 0);
          }, 0);

          const completedCount = week.reduce((acc, d) => {
            const k = format(d, 'yyyy-MM-dd');
            const planned = sessionsByDate[k] ?? [];
            const completedForDay = planned.filter((s) =>
              completedSessions?.some((c) => c.date === (s as any).date && c.session_title === (s as any).title)
            ).length;
            return acc + completedForDay;
          }, 0);

          return (
            <div
              key={`${format(wkStart, 'yyyy-MM-dd')}-${idx}`}
              className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))]"
            >
              {/* Week summary column */}
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-3">
                <div className="text-xs font-semibold text-gray-900">{weekLabel(wkStart)}</div>
                <div className="mt-1 text-[11px] text-gray-600">{weekRangeLabel(week)}</div>

                <div className="mt-3 space-y-1 text-[11px] text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Planned</span>
                    <span className="text-gray-900 font-medium">{plannedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Completed</span>
                    <span className="text-gray-900 font-medium">{completedCount}</span>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-gray-500">Drag sessions to reschedule</div>
              </div>

              {/* 7 day cells */}
              {week.map((dateObj) => {
                const dayKey = format(dateObj, 'yyyy-MM-dd');
                const outside = !isSameMonth(dateObj, currentMonth);

                return (
                  <div
                    key={dayKey}
                    className={[
                      // borders:
                      'border-b border-gray-200 border-l border-gray-200',
                      // sizing: allow growth and prevent overlap
                      'min-h-[170px] h-full',
                      // background
                      outside ? 'bg-gray-50' : 'bg-white',
                      isToday(dateObj) ? 'bg-gray-50' : '',
                    ].join(' ')}
                  >
                    <DayCell
                      date={dateObj}
                      sessions={sessionsByDate?.[dayKey] ?? []}
                      isOutside={outside}
                      completedSessions={completedSessions}
                      extraActivities={stravaByDate?.[dayKey] ?? []}
                      onSessionClick={onSessionClick}
                      onSessionAdded={onSessionAdded}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
