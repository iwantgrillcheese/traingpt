import { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from 'date-fns';

export function SidebarCalendar({
  currentMonth,
  selectedDate,
  onDateSelect,
}: {
  currentMonth: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}) {
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  useEffect(() => {
    const startMonth = startOfMonth(currentMonth);
    const endMonth = endOfMonth(currentMonth);
    const startDate = startOfWeek(startMonth, { weekStartsOn: 1 });
    const endDate = endOfWeek(endMonth, { weekStartsOn: 1 });

    const days: Date[] = [];
    for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
      days.push(day);
    }
    setCalendarDays(days);
  }, [currentMonth]);

  return (
    <div className="w-24 p-4 bg-white rounded-xl shadow-md select-none flex flex-col items-center">
      <div className="text-center font-semibold mb-4 text-sm leading-tight">
        {format(currentMonth, 'MMMM yyyy')}
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-400 w-full px-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
          <div key={d} className="text-center leading-none">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-2 text-center text-sm w-full">
        {calendarDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          const inMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              disabled={!inMonth}
              className={`rounded-full w-6 h-6 flex items-center justify-center
                ${isSelected ? 'bg-black text-white' : ''}
                ${isToday && !isSelected ? 'border border-gray-400' : ''}
                ${!inMonth ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-gray-100'}
              `}
              aria-label={`Select ${format(day, 'MMMM d, yyyy')}`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
