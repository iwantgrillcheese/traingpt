'use client';

import {
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  parseISO, // ✅ ADD THIS
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
    <div className="space-y-2">
      <div className="grid grid-cols-7 text-[11px] text-muted-foreground px-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center font-medium">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border rounded-lg overflow-hidden gap-y-1">
        {days.map((day) => {
          const daySessions = sessions.filter((s) =>
            isSameDay(parseISO(s.date), day) // ✅ FIXED HERE
          );

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
