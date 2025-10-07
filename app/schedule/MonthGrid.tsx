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
import { useMemo, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
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
  onSessionAdded?: (session: any) => void;
};

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  completedSessions,
  stravaByDate,
  onSessionClick,
}: Props) {
  // Local state for instant updates after inline add or drag/drop
  const [data, setData] = useState(sessionsByDate);

  // Compute month grid structure (weeks)
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

  // Handle new sessions added from InlineSessionForm
  const handleSessionAdded = (session: MergedSession) => {
    setData((prev) => ({
      ...prev,
      [session.date]: [...(prev[session.date] || []), session],
    }));
  };

  // Handle drag/drop date change
  async function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sessionId = active.id;
    const newDate = over.id;

    // Optimistic local update
    setData((prev) => {
      const next = { ...prev };
      let moved: MergedSession | undefined;

      for (const dateKey of Object.keys(next)) {
        const sessions = next[dateKey] || [];
        const idx = sessions.findIndex((s) => s.id === sessionId);
        if (idx !== -1) {
          moved = sessions[idx];
          next[dateKey] = sessions.filter((s) => s.id !== sessionId);
          break;
        }
      }

      if (moved) {
        const updated = { ...moved, date: newDate };
        next[newDate] = [...(next[newDate] || []), updated];
      }

      return next;
    });

    // Persist update to backend
    await fetch('/api/schedule/update-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, newDate }),
    });
  }

  return (
    <div className="w-full animate-fade-in space-y-2">
      {/* Header row */}
      <div className="grid grid-cols-7 text-center font-medium text-sm text-muted-foreground pb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-x-4 gap-y-4">
          {weeks.flatMap((week) =>
            week.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const isOutside = !isSameMonth(date, currentMonth);

              return (
                <DayCell
                  key={dateStr}
                  date={date}
                  isOutside={isOutside}
                  sessions={data[dateStr] || []}
                  completedSessions={completedSessions}
                  extraActivities={stravaByDate[dateStr] || []}
                  onSessionClick={onSessionClick}
                
                  onSessionAdded={handleSessionAdded}
                />
              );
            })
          )}
        </div>
      </DndContext>
    </div>
  );
}
