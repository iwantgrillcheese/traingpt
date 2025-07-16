'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  addMonths,
  subMonths,
  addDays,
} from 'date-fns';
import { generateCoachQuestion } from '@/utils/generateCoachQuestion';

export default function MobileCalendarView({
  plan,
  completed,
  stravaActivities,
}: {
  plan: {
    label: string;
    startDate: string;
    raceDate: string;
    days: Record<string, string[]>;
  };
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailedWorkouts, setDetailedWorkouts] = useState<Record<string, string>>({});
  const router = useRouter();

  const sessionsByDate = useMemo(() => {
    const sessions: Record<string, string[]> = {};

    Object.entries(plan.days).forEach(([date, items]) => {
      if (!sessions[date]) sessions[date] = [];
      sessions[date].push(...items);
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
  }, [plan.days, stravaActivities]);

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

  const getEmoji = (title: string) => {
    if (title.toLowerCase().includes('swim')) return '🏊';
    if (title.toLowerCase().includes('bike')) return '🚴';
    if (title.toLowerCase().includes('run')) return '🏃';
    return '📋';
  };

  const handleGenerateWorkout = async (title: string, date: string) => {
    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date }),
    });
    const { workout } = await res.json();
    const key = `${date}-${title}`;
    setDetailedWorkouts((prev) => ({ ...prev, [key]: workout }));
  };

  const handleSessionClick = (dateStr: string, session: string) => {
    const question = generateCoachQuestion(format(parseISO(dateStr), 'MMMM d'), session);
    router.push(`/coaching?q=${encodeURIComponent(question)}`);
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedSessions = sessionsByDate[selectedDateStr] || [];

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-10">
      {/* Calendar header omitted for brevity */}

      <div className="grid grid-cols-7 text-center font-medium text-xs text-gray-400 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-sm">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const dotColor = (() => {
            const sessions = sessionsByDate[dateStr] || [];
            if (sessions.some((s) => getSessionStatus(dateStr, s) === 'done')) return 'bg-green-500';
            if (sessions.some((s) => getSessionStatus(dateStr, s) === 'skipped')) return 'bg-gray-400';
            if (sessions.length > 0) return 'bg-blue-500';
            return '';
          })();

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

      {selectedSessions.length > 0 && (
        <div className="mt-8 bg-white border border-neutral-200 rounded-xl shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-600 mb-3">
            {format(selectedDate, 'EEEE, MMMM d')}
          </div>

          <div className="flex flex-col gap-4 text-sm">
            {selectedSessions.map((s: string, i: number) => {
              const key = `${selectedDateStr}-${s}`;
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span>{getEmoji(s)}</span>
                    <span
                      onClick={() => handleSessionClick(selectedDateStr, s)}
                      className="text-blue-600 underline cursor-pointer"
                    >
                      {s.replace(/^\w+: /, '')}
                    </span>
                  </div>
                  {detailedWorkouts[key] ? (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-md p-2 text-[13px] whitespace-pre-wrap">
                      {detailedWorkouts[key]}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateWorkout(s, selectedDateStr)}
                      className="self-start text-xs text-blue-600 underline"
                    >
                      Generate detailed workout
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <textarea
            placeholder="Leave a note..."
            className="mt-4 w-full border border-neutral-300 rounded-md p-2 text-sm"
            rows={3}
          />

          <div className="flex justify-end gap-3 mt-4">
            <button className="text-sm text-gray-500">Skip</button>
            <button className="bg-black text-white text-sm px-4 py-2 rounded-md">Mark Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
