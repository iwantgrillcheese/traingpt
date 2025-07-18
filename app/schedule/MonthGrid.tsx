'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format,
  subMonths,
  addMonths,
  parseISO,
} from 'date-fns';
import DayCell from './DayCell';
import type { Session } from '@/types/session';

export default function MonthGrid({ sessions }: { sessions: Session[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday

  const days: Date[] = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => addDays(calendarStart, i));
  }, [calendarStart]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <section className="max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <button onClick={handlePrevMonth} className="text-muted-foreground">&larr;</button>
        <h2 className="text-xl font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button onClick={handleNextMonth} className="text-muted-foreground">&rarr;</button>
      </header>

      <div className="grid grid-cols-7 gap-px bg-border border rounded-md overflow-hidden">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-xs font-medium p-2 bg-muted text-center">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const daySessions = sessions.filter((s) =>
            isSameDay(parseISO(s.date), day)
          );

          return (
            <DayCell
              key={day.toISOString()}
              date={day}
              sessions={daySessions}
              isFaded={!isSameMonth(day, currentMonth)}
            />
          );
        })}
      </div>
    </section>
  );
}
