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
import { useDroppable } from '@dnd-kit/core';
import DayCell from './DayCell';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';

type CompletedSession = {
  date: string;
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

function DroppableDay({
  date,
  children,
}: {
  date: Date;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: format(date, 'yyyy-MM-dd'),
  });

  return (
    <div ref={setNodeRef} className="relative">
      {children}
    </div>
  );
}

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
    <div className="w-full animate-fade-in space-y-2">
      <div className="grid grid-cols-7 text-center font-medium text-sm text-muted-foreground pb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="tracking-wide">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-x-4 gap-y-4">
        {weeks.flatMap((week) =>
          week.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isOutside = !isSameMonth(date, currentMonth);

            return (
              <DroppableDay key={dateStr} date={date}>
                <DayCell
                  date={date}
                  isOutside={isOutside}
                  sessions={sessionsByDate[dateStr] || []}
                  completedSessions={completedSessions}
                  extraActivities={stravaByDate[dateStr] || []}
                  onSessionClick={onSessionClick}
                />
              </DroppableDay>
            );
          })
        )}
      </div>
    </div>
  );
}
