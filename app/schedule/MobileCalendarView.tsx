'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
} from 'date-fns';
import { generateCoachQuestion } from '@/utils/generateCoachQuestion';

export default function MobileCalendarView({ plan, completed, stravaActivities }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const router = useRouter();

  const sessionsByDate = useMemo(() => {
    const sessions: Record<string, string[]> = {};

    plan.forEach((week: any) => {
      Object.entries(week.days).forEach(([date, raw]) => {
        const items = raw as string[];
        if (!sessions[date]) sessions[date] = [];
        sessions[date].push(...items);
      });
    });

    stravaActivities.forEach((activity: any) => {
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

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const startDayOffset = start.getDay();
    const calendarStart = new Date(start);
    calendarStart.setDate(start.getDate() - startDayOffset);
    return Array.from({ length: 35 }, (_, i) => addDays(calendarStart, i));
  }, [currentMonth]);

  const getSessionStatus = (date: string, label: string) => {
    const key = `${date}-${
      label.toLowerCase().includes('swim')
        ? 'swim'
        : label.toLowerCase().includes('bike')
        ? 'bike'
        : 'run'
    }`;
    return completed[key];
  };

  const getDotColor = (date: string) => {
    const sessions = sessionsByDate[date] || [];
    if (sessions.some((s) => getSessionStatus(date, s) === 'done')) return 'bg-green-500';
    if (sessions.some((s) => getSessionStatus(date, s) === 'skipped')) return 'bg-gray-400';
    if (sessions.length > 0) return 'bg-blue-500';
    return '';
  };

  const handleSessionClick = (dateStr: string, session: string) => {
    const question = generateCoachQuestion(format(parseISO(dateStr), 'MMMM d'), session);
    router.push(`/coaching?q=${encodeURIComponent(question)}`);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-sm text-gray-500 hover:text-black"
        >
          ←
        </button>
        <h2 className="font-semibold text-base tracking-tight">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-sm text-gray-500 hover:text-black"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-xs text-gray-400 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-sm">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const dotColor = getDotColor(dateStr);

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center justify-center rounded-lg py-2 transition-all ${
                isSelected
                  ? 'bg-black text-white font-medium shadow'
                  : 'text-gray-700 hover:bg-neutral-100'
              }`}
            >
              <div>{format(day, 'd')}</div>
              <div className={`w-1.5 h-1.5 rounded-full mt-1 ${dotColor}`}></div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-gray-600 mb-2">
          {format(selectedDate, 'EEEE, MMMM d')}
        </div>

        <div className="flex flex-col gap-2">
          {(sessionsByDate[format(selectedDate, 'yyyy-MM-dd')] || []).map((s: string, i: number) => {
            const status = getSessionStatus(format(selectedDate, 'yyyy-MM-dd'), s);
            const color =
              status === 'done'
                ? 'text-green-600'
                : status === 'skipped'
                ? 'text-gray-400 line-through'
                : 'text-blue-600';

            return (
              <div
                key={i}
                onClick={() =>
                  handleSessionClick(format(selectedDate, 'yyyy-MM-dd'), s)
                }
                className={`${color} cursor-pointer hover:underline transition`}
              >
                {s}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
