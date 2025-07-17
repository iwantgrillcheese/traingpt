// FINALIZED: RichCalendarView.tsx — true 7x5 calendar layout w/ week phase headers
'use client';

import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  subMonths,
  addMonths,
} from 'date-fns';
import { SessionModal } from './SessionModal';

export default function RichCalendarView({
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
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [detailedWorkoutMap, setDetailedWorkoutMap] = useState<Record<string, string>>({});

  const cleanLabel = (title: string) => title.replace(/^[^:]+:\s*/, '').trim();

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

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });

  const calendarDays = Array.from({ length: 35 }).map((_, i) => {
    const date = addDays(gridStart, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    return {
      date,
      dateStr,
      isCurrentMonth: isSameMonth(date, monthStart),
      isToday: isToday(date),
      sessions: sessionsByDate[dateStr] || [],
    };
  });

  const handleGenerateDetailedWorkout = async (session: any) => {
    const key = `${session.date}-${cleanLabel(session.title)}`;
    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: session.title, date: session.date }),
    });
    const { workout } = await res.json();
    setDetailedWorkoutMap((prev) => ({ ...prev, [key]: workout }));
    setActiveSession((prev: any) => ({ ...prev, aiWorkout: workout }));
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 py-10">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold text-neutral-900">Your Training Plan</h2>
        <div className="flex gap-4 text-sm">
          <button onClick={() => setSelectedDate(subMonths(selectedDate, 1))}>
            ← Prev
          </button>
          <button onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-gray-500 text-[13px] font-medium mb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-5 gap-2 bg-white rounded-2xl p-4 shadow-sm">
        {calendarDays.map(({ date, dateStr, isCurrentMonth, isToday, sessions }) => (
          <div
            key={dateStr}
            onClick={() => {
              const first = sessions?.[0];
              if (!first) return;
              const key = `${dateStr}-${cleanLabel(first)}`;
              setActiveSession({
                date: dateStr,
                title: first,
                status: completed[
                  `${dateStr}-$
                    {
                      first.toLowerCase().includes('swim')
                        ? 'swim'
                        : first.toLowerCase().includes('bike')
                        ? 'bike'
                        : 'run'
                    }`
                ],
                aiWorkout: detailedWorkoutMap[key] || null,
                userNote: '',
              });
            }}
            className={`min-h-[100px] rounded-xl border px-2 py-1 text-[13px] flex flex-col gap-[2px] cursor-pointer transition-all
              ${isToday ? 'border-black' : 'border-neutral-200'}
              ${!isCurrentMonth ? 'opacity-50' : ''}
            `}
          >
            <div className="text-[11px] font-semibold text-neutral-400">
              {format(date, 'd')}
            </div>
            {sessions.map((s, i) => (
              <div key={i} className="text-neutral-800 truncate">
                {cleanLabel(s)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {activeSession && (
        <SessionModal
          session={activeSession}
          onClose={() => setActiveSession(null)}
          onGenerateWorkout={() => handleGenerateDetailedWorkout(activeSession)}
        />
      )}
    </div>
  );
}
