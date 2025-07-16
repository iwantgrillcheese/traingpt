import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import React from 'react';

export type Session = {
  id: string;
  date: string; // 'yyyy-MM-dd'
  title: string;
  type: 'swim' | 'bike' | 'run' | 'other';
  color: string; // Tailwind CSS background color class e.g. 'bg-blue-500'
};

export function MonthGrid({
  year,
  month,
  sessions,
  onDayClick,
  onSessionClick,
}: {
  year: number;
  month: number; // 0-based
  sessions: Session[];
  onDayClick: (date: Date) => void;
  onSessionClick: (session: Session) => void;
}) {
  const startDate = startOfWeek(new Date(year, month, 1), { weekStartsOn: 1 });

  const calendarDays = Array.from({ length: 42 }).map((_, i) =>
    addDays(startDate, i)
  );

  // Group sessions by date for easy lookup
  const sessionsByDate = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-7 gap-2 select-none">
      {/* Weekday headers */}
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div
          key={d}
          className="text-center text-xs font-semibold text-gray-500 border-b pb-1"
        >
          {d}
        </div>
      ))}

      {calendarDays.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const daySessions = sessionsByDate[dayStr] || [];
        const isToday = isSameDay(day, new Date());
        const inMonth = day.getMonth() === month;

        return (
          <button
            key={dayStr}
            onClick={() => onDayClick(day)}
            disabled={!inMonth}
            className={`relative flex flex-col p-2 min-h-[110px] rounded-lg border text-left
              ${isToday ? 'border-black font-semibold' : 'border-gray-200'}
              ${!inMonth ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-gray-50'}
            `}
          >
            {/* Date label */}
            <div className="text-xs mb-1">{format(day, 'd')}</div>

            {/* Sessions list */}
            <div className="flex flex-col gap-1 overflow-hidden">
              {daySessions.map((session) => (
                <button
                  key={session.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionClick(session);
                  }}
                  className={`truncate text-xs rounded px-2 py-0.5 cursor-pointer
                    ${session.color} text-white shadow-sm hover:brightness-90`}
                  title={session.title}
                >
                  {session.title}
                </button>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
