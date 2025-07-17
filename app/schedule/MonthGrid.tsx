// MonthGrid.tsx — Full 7x5 Calendar Grid
'use client';

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  format,
} from 'date-fns';
import React from 'react';

export default function MonthGrid({
  selectedMonth,
  sessionsByDate,
  onClickDate,
}: {
  selectedMonth: Date;
  sessionsByDate: Record<string, string[]>;
  onClickDate?: (date: string) => void;
}) {
  const today = new Date();
  const start = startOfWeek(startOfMonth(selectedMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(selectedMonth), { weekStartsOn: 1 });

  const days = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return (
    <div className="grid grid-cols-7 gap-[1px] rounded-lg overflow-hidden bg-neutral-200">
      {days.map((date, i) => {
        const iso = format(date, 'yyyy-MM-dd');
        const isToday = isSameDay(date, today);
        const isCurrentMonth = isSameMonth(date, selectedMonth);
        const sessions = sessionsByDate[iso] || [];

        return (
          <div
            key={i}
            onClick={() => onClickDate?.(iso)}
            className={`bg-white p-2 min-h-[80px] text-xs cursor-pointer flex flex-col rounded-sm transition-all
              ${!isCurrentMonth ? 'text-neutral-300' : ''} 
              ${isToday ? 'border border-black' : 'border border-transparent'}`}
          >
            <div className="font-medium text-neutral-500 text-[11px] mb-1">
              {format(date, 'd')}
            </div>
            <div className="flex flex-col gap-[1px] overflow-hidden">
              {sessions.slice(0, 2).map((s, i) => (
                <div
                  key={i}
                  className="truncate rounded bg-neutral-100 px-1 py-[1px] text-[10px] text-neutral-800"
                >
                  {s.replace(/\w+:\s*/, '')}
                </div>
              ))}
              {sessions.length > 2 && (
                <div className="text-[10px] text-neutral-400">+{sessions.length - 2} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
