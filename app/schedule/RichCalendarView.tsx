// PATCHED: RichCalendarView.tsx (updated with OpenAI-style colors)
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

    const allDates = Object.keys(plan?.[0]?.days || {}).sort();
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
    <div className="w-full max-w-[1400px] mx-auto px-6 py-10 bg-neutral-900 rounded-3xl shadow-md">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Your Training Plan</h2>
        <div className="flex gap-4 text-sm">
          {monthIndex > 0 && (
            <button className="text-neutral-400 hover:text-white" onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))}>
              ← Prev
            </button>
          )}
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button className="text-neutral-400 hover:text-white" onClick={() => setMonthIndex((prev) => prev + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-[13px] text-neutral-400 mb-4">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {visibleWeeks.map((week, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-4 mb-6">
          {week.map((date) => {
            const sessions = sessionsByDate[date] || [];
            const isToday = isSameDay(parseISO(date), today);

            const sessionElements = sessions.slice(0, 2).map((s, i) => {
              const clean = s.replace(/^\w+:\s*/, '');
              const emoji = s.toLowerCase().includes('swim') ? '🏊'
                : s.toLowerCase().includes('bike') ? '🚴'
                : s.toLowerCase().includes('run') ? '🏃'
                : '📋';
              const isMain = i === 0;

              return (
                <div
                  key={i}
                  className={`${isMain ? 'text-[15px] font-semibold text-white' : 'text-[13px] text-neutral-400'} flex items-center gap-1`}
                >
                  <span>{emoji}</span>
                  <span className="truncate">{clean}</span>
                </div>
              );
            });

            const status = (() => {
              if (sessions.some((s) => completed[`${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`] === 'done')) return 'done';
              if (sessions.some((s) => completed[`${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`] === 'skipped')) return 'skipped';
              return sessions.length ? 'planned' : null;
            })();

            const statusColor = status === 'done'
              ? 'bg-emerald-500'
              : status === 'skipped'
              ? 'bg-neutral-400'
              : status === 'planned'
              ? 'bg-cyan-500'
              : '';

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
                  relative bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 cursor-pointer flex flex-col justify-start min-h-[140px]
                  transition-all hover:shadow-md hover:ring-1 hover:ring-neutral-600
                  ${isToday ? 'border-white ring-2 ring-white/70' : ''}
                `}
              >
                <div className="text-[12px] font-medium text-neutral-400 mb-1">{format(parseISO(date), 'MMM d')}</div>

                {sessionElements}

                {statusColor && (
                  <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusColor}`} />
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
      )}
    </div>
  );
}