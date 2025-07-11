'use client';

import Calendar from 'react-calendar';
import type { CalendarType } from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Dispatch, SetStateAction } from 'react';
import { format, addMonths, subMonths } from 'date-fns';

interface CalendarSidebarProps {
  month: Date;
  setMonth: Dispatch<SetStateAction<Date>>;
  sessionsByDate: Record<string, string[]>;
}

export default function CalendarSidebar({
  month,
  setMonth,
  sessionsByDate,
}: CalendarSidebarProps) {
  return (
    <div className="w-full lg:w-72 space-y-6">
      {/* Month + Mini Calendar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-neutral-800">
            {format(month, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="text-neutral-400 hover:text-black"
            >
              ←
            </button>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="text-neutral-400 hover:text-black"
            >
              →
            </button>
          </div>
        </div>

        <Calendar
          value={month}
          onActiveStartDateChange={({ activeStartDate }) => {
            if (activeStartDate) setMonth(activeStartDate);
          }}
          tileContent={({ date, view }) => {
            const key = format(date, 'yyyy-MM-dd');
            const hasSession = !!sessionsByDate[key]?.length;
            return view === 'month' && hasSession ? (
              <div className="mt-1 w-1.5 h-1.5 rounded-full mx-auto bg-blue-400" />
            ) : null;
          }}
          calendarType={'US' as CalendarType}
          locale="en-US"
          className="!bg-white !text-black !border-none rounded-md"
          tileClassName={({ date, view }) =>
            view === 'month' && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              ? '!bg-blue-100 !rounded-full'
              : ''
          }
        />
      </div>

      {/* Upcoming Sessions */}
      <div className="text-sm text-neutral-800 overflow-y-auto max-h-[400px] pr-2">
        <h3 className="font-semibold mb-2">Upcoming</h3>
        {Object.entries(sessionsByDate)
          .filter(([date]) => new Date(date) >= new Date())
          .slice(0, 5)
          .map(([date, sessions]) => (
            <div key={date} className="mb-3">
              <div className="text-xs text-neutral-400">{format(new Date(date), 'eee MMM d')}</div>
              <ul className="list-disc ml-4 mt-1 text-sm text-black">
                {sessions.slice(0, 2).map((s, i) => (
                  <li key={i}>{s.length > 35 ? s.slice(0, 32) + '…' : s}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
