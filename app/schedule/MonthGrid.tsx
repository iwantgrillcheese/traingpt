import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export type Session = {
  id: string;
  date: string; // 'yyyy-MM-dd'
  title: string;
  type: 'swim' | 'bike' | 'run' | 'other';
  color: string; // Tailwind color class like 'bg-blue-500'
};

export function MonthGrid({
  year,
  month,
  sessions,
  onDayClick,
}: {
  year: number;
  month: number; // 0-based (0 = January)
  sessions: Session[];
  onDayClick: (date: Date) => void;
}) {
  // Calculate start of first week (Monday) covering the month
  const startDate = startOfWeek(new Date(year, month, 1), { weekStartsOn: 1 });

  // 6 weeks * 7 days = 42 days total
  const calendarDays = Array.from({ length: 42 }).map((_, i) =>
    addDays(startDate, i)
  );

  // Group sessions by date for quick lookup
  const sessionsByDate = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-7 gap-2 select-none">
      {/* Weekday headers */}
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
        <div key={d} className="text-center text-xs font-semibold text-gray-500">
          {d}
        </div>
      ))}

      {/* Days */}
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
            className={`relative p-2 h-24 flex flex-col rounded-lg border
              ${isToday ? 'border-black font-semibold' : 'border-gray-200'}
              ${!inMonth ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-gray-50'}
            `}
          >
            <div className="text-xs mb-1">{format(day, 'd')}</div>
            <div className="flex flex-wrap gap-0.5">
              {daySessions.map((session) => (
                <span
                  key={session.id}
                  className={`${session.color} rounded-full w-2 h-2`}
                  title={session.title}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
