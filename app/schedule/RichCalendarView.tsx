// PATCHED: RichCalendarView.tsx
'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { SessionModal } from './SessionModal';

export default function RichCalendarView({ plan, completed, stravaActivities }: {
  plan: any[];
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const today = new Date();
  const router = useRouter();
const [monthIndex, setMonthIndex] = useState(() => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const allDates = Object.keys(plan?.[0]?.days || {}).sort(); // You could also use sessionsByDate keys here
  if (!allDates.length) return 0;

  const start = startOfWeek(parseISO(allDates[0]), { weekStartsOn: 1 });

  let curr = start;
  let index = 0;

  while (curr <= new Date()) {
    const weekStart = addDays(curr, 0);
    const weekEnd = addDays(curr, 6);
    const inWeek = new Date() >= weekStart && new Date() <= weekEnd;

    if (inWeek) break;

    curr = addDays(curr, 7);
    index++;
  }

  return Math.floor(index / 4);
});
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [detailedWorkoutMap, setDetailedWorkoutMap] = useState<Record<string, string>>({});

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

  const cleanLabel = (title: string) => {
    return title.replace(/^\w+(:)?\s?/, '').trim();
  };

const handleGenerateDetailedWorkout = async (session: any) => {
  const key = `${session.date}-${cleanLabel(session.title)}`;
  const res = await fetch('/api/generate-detailed-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: session.title, date: session.date })
  });

  const { workout } = await res.json();

  setDetailedWorkoutMap(prev => ({ ...prev, [key]: workout }));
  setActiveSession((prev: any) => ({ ...prev, aiWorkout: workout }));
};

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 py-10 bg-neutral-50 rounded-3xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-800">Your Training Plan</h2>
        <div className="flex gap-4 text-sm">
          {monthIndex > 0 && (
            <button className="text-gray-500 hover:text-black" onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))}>
              ← Prev
            </button>
          )}
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button className="text-gray-500 hover:text-black" onClick={() => setMonthIndex((prev) => prev + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-[13px] text-gray-500 mb-4">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {visibleWeeks.map((week, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-4 mb-6">
  {week.map((date) => {
    const sessions = sessionsByDate[date] || [];
    const isToday = isSameDay(parseISO(date), today);

    return (
      <div
        key={date}
        onClick={() => {
          const first = sessions[0];
          if (!first) return;
          const key = `${date}-${first}`;
          setActiveSession({
            date,
            title: first,
            status: completed[`${date}-${first.toLowerCase().includes('swim') ? 'swim' : first.toLowerCase().includes('bike') ? 'bike' : 'run'}`],
            aiWorkout: detailedWorkoutMap[key] || null,
            userNote: '',
          });
        }}
        className={`
          bg-white border rounded-2xl p-3 text-[13px] leading-tight cursor-pointer flex flex-col gap-1
          transition-all shadow-sm hover:shadow-md hover:ring-1 hover:ring-neutral-300
          ${isToday ? 'border-black ring-2 ring-black/70' : 'border-neutral-200'}
        `}
      >
        <div className="text-[11px] font-medium text-neutral-400 tracking-wide">
          {format(parseISO(date), 'MMM d')}
        </div>

        {sessions.slice(0, 3).map((s, i) => {
          const status = completed[`${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`];
          const emoji = s.toLowerCase().includes('swim')
            ? '🏊'
            : s.toLowerCase().includes('bike')
            ? '🚴'
            : s.toLowerCase().includes('run')
            ? '🏃'
            : '📋';

          const dot = status === 'done'
            ? 'bg-green-500'
            : status === 'skipped'
            ? 'bg-gray-400'
            : 'bg-blue-500';

          return (
            <div key={i} className="flex items-center gap-2 text-neutral-800">
              <span>{emoji}</span>
              <span className="truncate">{s.replace(/^\w+:\s/, '')}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            </div>
          );
        })}

        {sessions.length > 3 && (
          <div className="text-[11px] text-gray-400 mt-1">+{sessions.length - 3} more</div>
        )}
      </div>
    );
  })}
</div>
      ))}

      {activeSession && (
        <SessionModal
  session={activeSession}
  onClose={() => {
    const key = `${activeSession.date}-${cleanLabel(activeSession.title)}`;
    if (activeSession.workout) {
      setDetailedWorkoutMap(prev => ({ ...prev, [key]: activeSession.workout }));
    }
    setActiveSession(null);
  }}
  onGenerateWorkout={() => handleGenerateDetailedWorkout(activeSession)}
/>
      )}</div>
  );
}
