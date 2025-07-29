'use client';

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
} from 'date-fns';
import { useMemo } from 'react';
import DayCell from './DayCell';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  currentMonth: Date;
  sessionsByDate: Record<string, MergedSession[]>;
  completedSessions: CompletedSession[];
  stravaByDate: Record<string, StravaActivity[]>;
  onSessionClick?: (session: MergedSession) => void;
};

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  completedSessions,
  stravaByDate,
  onSessionClick,
}: Props) {
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
    <div className="grid grid-cols-7 gap-x-6 gap-y-4">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="text-center font-medium text-sm text-muted-foreground">
          {day}
        </div>
      ))}

      {weeks.flatMap((week) =>
        week.map((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const isOutside = !isSameMonth(date, currentMonth);

          return (
            <DayCell
              key={dateStr}
              date={date}
              isOutside={isOutside}
              sessions={sessionsByDate[dateStr] || []}
              completedSessions={completedSessions}
              extraActivities={stravaByDate[dateStr] || []}
              onSessionClick={onSessionClick}
            />
          );
        })
      )}
    </div>
  );
}
