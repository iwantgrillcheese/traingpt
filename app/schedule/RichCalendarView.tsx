'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays, isAfter } from 'date-fns';

export default function RichCalendarView({ plan, completed, stravaActivities }: {
  plan: any[];
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const today = new Date();
  const [monthIndex, setMonthIndex] = useState(0);

  const sessionsByDate = useMemo(() => {
    const sessions: Record<string, string[]> = {};

    plan.forEach((week) => {
      Object.entries(week.days).forEach(([date, raw]) => {
        const items = raw as string[];
        if (!sessions[date]) sessions[date] = [];
        sessions[date].push(...items);
      });
    });

    stravaActivities.forEach((activity) => {
      const date = activity.start_date_local.split('T')[0];
      const sport = activity.sport_type.toLowerCase();
      const mapped = sport === 'ride' || sport === 'virtualride' ? 'bike' : sport;
      const mins = Math.round(activity.moving_time / 60);
      const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${mins}min (Strava)`;
      if (!sessions[date]) sessions[date] = [];
      sessions[date].push(label);
    });

    return sessions;
  }, [plan, stravaActivities]);

  const calendarRange = useMemo(() => {
    const allDates = Object.keys(sessionsByDate).sort();
    if (!allDates.length) return [];
    const start = startOfWeek(parseISO(allDates[0]), { weekStartsOn: 1 });
    const end = parseISO(allDates[allDates.length - 1]);
    const weeks = [];
    let curr = start;

    while (curr <= end) {
      const week = Array.from({ length: 7 }).map((_, i) => format(addDays(curr, i), 'yyyy-MM-dd'));
      weeks.push(week);
      curr = addDays(curr, 7);
    }

    return weeks;
  }, [sessionsByDate]);

  const visibleWeeks = calendarRange.slice(monthIndex * 4, monthIndex * 4 + 4);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-xl font-bold sm:text-2xl">Your Training Plan</h2>
        <div className="flex gap-2">
          {monthIndex > 0 && (
            <button
              className="text-sm text-gray-600 hover:text-black"
              onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))}
            >
              ← Prev
            </button>
          )}
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button
              className="text-sm text-gray-600 hover:text-black"
              onClick={() => setMonthIndex((prev) => prev + 1)}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-xs sm:text-sm text-gray-500 mb-2 min-w-[700px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {visibleWeeks.map((week, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-2 mb-4 min-w-[700px]">
          {week.map((date) => (
            <div
              key={date}
              className={`min-h-[100px] border rounded-xl px-2 py-2 text-left text-[10px] sm:text-xs bg-white shadow-sm flex flex-col gap-1 whitespace-pre-wrap ${
                isSameDay(parseISO(date), today) ? 'border-black' : 'border-gray-200'
              }`}
            >
              <div className="text-gray-400 font-semibold">
                {format(parseISO(date), 'MMM d')}
              </div>
              {(sessionsByDate[date] || []).map((s, i) => {
                const status = completed[
                  `${date}-${
                    s.toLowerCase().includes('swim')
                      ? 'swim'
                      : s.toLowerCase().includes('bike')
                      ? 'bike'
                      : 'run'
                  }`
                ];
                const color =
                  status === 'done'
                    ? 'text-green-700'
                    : status === 'skipped'
                    ? 'text-gray-400 line-through'
                    : 'text-blue-700';
                return (
                  <div key={i} className={`${color}`}>• {s}</div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
