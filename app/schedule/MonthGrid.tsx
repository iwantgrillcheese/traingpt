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

  // How many week rows are actually rendered (skip fully-outside weeks)
  const renderedWeeks = useMemo(() => {
    return weeks.filter((w) => !w.every((d) => !isSameMonth(d, currentMonth)));
  }, [weeks, currentMonth]);

  // Make rows expand to fill the screen (Intervals feel)
  // Header + some padding: adjust constant as needed
  const rowHeightStyle = useMemo(() => {
    const rows = Math.max(renderedWeeks.length, 4);
    return {
      // 56px header row, ~24px outer padding -> leave the rest for week rows
      height: `calc((100dvh - 170px) / ${rows})`,
      minHeight: '150px',
      maxHeight: '240px',
    } as React.CSSProperties;
  }, [renderedWeeks.length]);

  return (
    <div className="w-full">
      {/* Sticky header row (desktop app vibe) */}
      <div className="sticky top-14 z-10 bg-white">
        <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))] items-center text-xs text-gray-500 border-b border-gray-200">
          <div className="px-4 py-3 font-medium text-gray-600">
            Week
          </div>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-3 py-3 text-center font-medium text-gray-600">
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Continuous surface */}
      <div className="w-full border border-gray-200 bg-gray-200 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-px">
          {renderedWeeks.map((week, idx) => {
            const wkStart = week[0];

            const plannedCount = week.reduce((acc, d) => {
              const k = format(d, 'yyyy-MM-dd');
              return acc + (sessionsByDate[k]?.length ?? 0);
            }, 0);

            const completedCount = week.reduce((acc, d) => {
              const k = format(d, 'yyyy-MM-dd');
              const planned = sessionsByDate[k] ?? [];
              const c = planned.filter((s) =>
                completedSessions?.some(
                  (row) => row.date === (s as any).date && row.session_title === (s as any).title
                )
              ).length;
              return acc + c;
            }, 0);

            return (
              <div
                key={`${format(wkStart, 'yyyy-MM-dd')}-${idx}`}
                className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))] gap-px bg-gray-200"
                style={rowHeightStyle}
              >
                {/* Week column */}
                <div className="bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-900">
                        {weekLabel(wkStart)}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {weekRangeLabel(week)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-gray-500">Planned</div>
                      <div className="text-sm font-semibold text-gray-900 leading-tight">
                        {plannedCount}
                      </div>
                      <div className="mt-2 text-[11px] text-gray-500">Completed</div>
                      <div className="text-sm font-semibold text-gray-900 leading-tight">
                        {completedCount}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-gray-500">
                    {/* placeholder for future load/fitness */}
                    Drag sessions to reschedule
                  </div>
                </div>

                {/* Days */}
                {week.map((dateObj) => {
                  const dayKey = format(dateObj, 'yyyy-MM-dd');
                  const outside = !isSameMonth(dateObj, currentMonth);

                  return (
                    <div
                      key={dayKey}
                      className={[
                        'bg-white',
                        outside ? 'bg-gray-50' : '',
                        isToday(dateObj) ? 'ring-1 ring-gray-900/10 z-[1]' : '',
                      ].join(' ')}
                    >
                      {/* IMPORTANT: DayCell should not add extra outer borders that fight the grid.
                         If DayCell is currently “cardy”, we’ll tune it (you already asked). */}
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
    </div>
  );
}
