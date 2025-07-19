'use client';

import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
} from 'date-fns';
import type { Session } from '@/types/session';
import DayCell from './DayCell';

type Props = {
  sessions: Session[];
  onSessionClick?: (session: Session) => void;
};

export default function MonthGrid({ sessions, onSessionClick }: Props) {
  const today = new Date();
  const start = startOfWeek(startOfMonth(today), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(today), { weekStartsOn: 1 });

  const days = [];
  let current = start;

  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return (
    <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
      {days.map((day) => {
        const daySessions = sessions.filter((s) => isSameDay(new Date(s.date), day));
        return (
          <DayCell
            key={day.toISOString()}
            date={day}
            sessions={daySessions}
            isOutside={!isSameMonth(day, today)}
            onSessionClick={onSessionClick}
          />
        );
      })}
    </div>
  );
}
