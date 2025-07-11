'use client';

import Calendar from 'react-calendar';
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
  const getColor = (title: string) => {
    const s = title.toLowerCase();
    if (s.includes('swim')) return 'bg-cyan-400';
    if (s.includes('bike')) return 'bg-orange-400';
    if (s.includes('run')) return 'bg-pink-400';
    return 'bg-neutral-400';
  };

  return (
    <div className="w-full lg:w-64 space-y-6">
      {/* Mini Calendar with Month Nav */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="text-neutral-400 hover:text-black"
          >
            ←
          </button>
          <span className="text-sm font-medium text-neutral-700">
            {format(month, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="text-neutral-400 hover:text-black"
          >
            →
          </button>
        </div>

        <Calendar
          value={month}
          onActiveStartDateChange={({ activeStartDate }) => {
            if (activeStartDate) setMonth(activeStartDate);
          }}
          tileContent={({ date, view }) => {
            const key = format(date, 'yyyy-MM-dd');
            const sessions = sessionsByDate[key] || [];
            if (view !== 'month' || !sessions.length) return null;
            const color = getColor(sessions[0]); // use first session type
            return <div className={`mt-1 w-1.5 h-1.5 rounded-full mx-auto ${color}`} />;
          }}
          calendarType="gregory"
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
      <div className="text-sm text-neutral-800 overflow-y-auto max-h-[400px] pr-1">
        <h3 className="text-xs uppercase text-neutral-400 font-semibold mb-2">Upcoming</h3>
        {Object.entries(sessionsByDate)
          .filter(([date]) => new Date(date) >= new Date())
          .slice(0, 5)
          .map(([date, sessions]) => (
            <div key={date} className="mb-3">
              <div className="text-[11px] text-neutral-400 mb-1">
                {format(new Date(date), 'eee MMM d')}
              </div>
              <div className="space-y-1">
                {sessions.slice(0, 2).map((s, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-black truncate">
                    <div className={`w-1.5 h-1.5 rounded-full ${getColor(s)}`} />
                    <span className="truncate">{s.length > 40 ? s.slice(0, 38) + '…' : s}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
