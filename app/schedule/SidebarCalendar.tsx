// SidebarCalendar.tsx
'use client';

import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  parseISO,
  subMonths,
  addMonths,
} from 'date-fns';

type SidebarCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  allDates?: string[];
  sessions?: { date: string; title: string; sport?: string }[];
};

export function SidebarCalendar({
  selectedDate,
  onSelectDate,
  allDates = [],
  sessions = [],
}: SidebarCalendarProps) { {
  const currentMonth = useMemo(() => startOfMonth(selectedDate), [selectedDate]);
  const monthLabel = format(currentMonth, 'MMMM yyyy');
  const start = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

  const dates = useMemo(() => {
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [start, end]);

  const dateHasSession = (date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    return allDates.includes(iso);
  };

  return (
    <div className="p-4 rounded-2xl border bg-white w-full text-[13px] shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <strong className="text-sm text-neutral-800">Mini Calendar</strong>
        <span className="text-xs text-neutral-400">{monthLabel}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {dates.map((date, idx) => {
          const isToday = isSameDay(date, new Date());
          const isSelected = isSameDay(date, selectedDate);
          const inMonth = isSameMonth(date, currentMonth);

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`rounded-full w-7 h-7 flex items-center justify-center text-xs transition
                ${isToday ? 'border border-neutral-400' : ''}
                ${isSelected ? 'bg-black text-white' : ''}
                ${!inMonth ? 'text-gray-300' : ''}
                ${dateHasSession(date) && !isSelected ? 'text-black font-medium' : ''}`}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}}
