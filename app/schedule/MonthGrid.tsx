'use client';

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  format,
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

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  completedSessions,
  stravaByDate,
  onSessionClick,
  onSessionAdded,
}: MonthGridProps) {
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }

    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push(days.slice(i, i + 7));
    }
    return chunks;
  }, [currentMonth]);

  return (
    <div className="w-full animate-fade-in">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-3 px-1 pb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium tracking-wide text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-3">
        {weeks.flatMap((week) =>
          week.map((dateObj) => {
            const dayKey = format(dateObj, 'yyyy-MM-dd');
            const isOutside = !isSameMonth(dateObj, currentMonth);

            return (
              <DayCell
                key={dayKey}
                date={dateObj}
                sessions={sessionsByDate?.[dayKey] ?? []}
                isOutside={isOutside}
                completedSessions={completedSessions}
                extraActivities={stravaByDate?.[dayKey] ?? []}
                onSessionClick={onSessionClick}
                onSessionAdded={onSessionAdded}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
