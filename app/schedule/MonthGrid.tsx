'use client';

import {
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
  currentMonth: Date;
};

export default function MonthGrid({ sessions, onSessionClick, currentMonth }: Props) {
  const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

  const days = [];
  let current = start;

  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return (
    <div className="space-y-1">
      {/* Optional: Drop phase label here */}
      {/* <p className="text-sm text-muted-foreground italic text-center">Build Phase</p> */}

      {/* Weekday header row */}
      <div className="grid grid-cols-7 text-[11px] text-muted-foreground px-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {days.map((day) => {
          const daySessions = sessions.filter((s) => isSameDay(new Date(s.date), day));
          return (
            <DayCell
              key={day.toISOString()}
              date={day}
              sessions={daySessions}
              isOutside={!isSameMonth(day, currentMonth)}
              onSessionClick={onSessionClick}
            />
          );
        })}
      </div>
    </div>
  );
}
