'use client';

import {
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
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
    <div className="w-full space-y-4">
      <div className="grid grid-cols-7 text-sm text-muted-foreground font-medium w-full">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-4 w-full">
        {days.map((day) => {
          const daySessions = sessions.filter((s) =>
            isSameDay(parseISO(s.date), day)
          );

          return (
            <DayCell
              key={day.toISOString()}
              date={day}
              sessions={daySessions}
              isOutside={day.getMonth() !== currentMonth.getMonth()}
              onSessionClick={onSessionClick}
            />
          );
        })}
      </div>
    </div>
  );
}
