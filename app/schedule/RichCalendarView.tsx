'use client';

import { useEffect, useMemo, useRef } from 'react';
import { format, parseISO, isSameDay, isBefore, startOfWeek, addDays } from 'date-fns';

type Props = {
  plan: any[];
  completed: { [key: string]: string };
  stravaActivities: any[];
};

export default function RichCalendarView({ plan, completed, stravaActivities }: Props) {
  const today = new Date();
  const todayRef = useRef<HTMLDivElement | null>(null);

  // Map sessions + Strava workouts by date
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

  // Build calendar range
  const calendarRange = useMemo(() => {
    const allDates = Object.keys(sessionsByDate).sort();
    if (!allDates.length) return [];

    const start = startOfWeek(parseISO(allDates[0]), { weekStartsOn: 1 });
    const end = parseISO(allDates[allDates.length - 1]);
    const weeks = [];
    let curr = start;

    while (curr <= end) {
      const week = Array.from({ length: 7 }).map((_, i) =>
        format(addDays(curr, i), 'yyyy-MM-dd')
      );
      weeks.push(week);
      curr = addDays(curr, 7);
    }

    return weeks;
  }, [sessionsByDate]);

  // Scroll to current week
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4">
      <div className="grid grid-cols-7 text-center font-medium text-sm text-gray-600 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {calendarRange.map((week, idx) => {
        const isCurrentWeek = week.some((date) => isSameDay(parseISO(date), today));
        const isPastWeek = week.every((date) => isBefore(parseISO(date), today));

        return (
          <div
            key={idx}
            ref={isCurrentWeek ? todayRef : null}
            className={`grid grid-cols-7 gap-2 mb-4 transition-opacity ${
              isPastWeek ? 'opacity-30' : 'opacity-100'
            }`}
          >
            {week.map((date) => (
              <div
                key={date}
                className={`min-h-[110px] border rounded-lg p-2 text-left text-xs bg-white shadow-sm flex flex-col gap-1 ${
                  isSameDay(parseISO(date), today) ? 'border-black' : 'border-gray-200'
                }`}
              >
                <div className="text-[10px] text-gray-400 font-semibold mb-1">
                  {format(parseISO(date), 'MMM d')}
                </div>

                {(sessionsByDate[date] || []).map((s, i) => {
                  const sport =
                    s.toLowerCase().includes('swim')
                      ? 'swim'
                      : s.toLowerCase().includes('bike')
                      ? 'bike'
                      : 'run';

                  const status = completed[`${date}-${sport}`];
                  const color =
                    status === 'done'
                      ? 'text-green-700'
                      : status === 'skipped'
                      ? 'text-gray-400 line-through'
                      : 'text-blue-700';

                  return (
                    <div key={i} className={`${color} truncate`} title={s}>
                      {s}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
