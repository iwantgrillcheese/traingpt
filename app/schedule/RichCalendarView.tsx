// FINAL ✨ AWARD-WORTHY: RichCalendarView.tsx
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
    const allDates = Object.keys(plan?.[0]?.days || {}).sort();
    if (!allDates.length) return 0;
    const start = startOfWeek(parseISO(allDates[0]), { weekStartsOn: 1 });
    let curr = start;
    let index = 0;
    while (curr <= today) {
      const weekStart = addDays(curr, 0);
      const weekEnd = addDays(curr, 6);
      if (today >= weekStart && today <= weekEnd) break;
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

  const cleanLabel = (title: string) => title.replace(/^(🏊|🚴|🏃|📋)?\s?\w+(:)?\s?/, '').trim();

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
    <div className="w-full max-w-[1600px] mx-auto px-8 py-12 bg-[#F9FAFB] rounded-3xl shadow-sm">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-semibold text-neutral-900 tracking-tight">Your Training Plan</h2>
          <p className="text-sm text-neutral-600">Tap a session to view or generate a detailed workout</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-500 font-medium mb-1">
            {format(parseISO(visibleWeeks[0][0]), 'MMMM yyyy')}
          </div>
          <div className="flex gap-4 text-sm">
            {monthIndex > 0 && (
              <button className="text-neutral-500 hover:text-black" onClick={() => setMonthIndex(prev => Math.max(prev - 1, 0))}>← Prev</button>
            )}
            {calendarRange.length > (monthIndex + 1) * 4 && (
              <button className="text-neutral-500 hover:text-black" onClick={() => setMonthIndex(prev => prev + 1)}>Next →</button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-sm text-neutral-500 mb-4">
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
              const clean = cleanLabel(s);
              const emoji = s.toLowerCase().includes('swim') ? '🏊'
                : s.toLowerCase().includes('bike') ? '🚴'
                : s.toLowerCase().includes('run') ? '🏃'
                : '🧘';

              return (
                <div
                  key={i}
                  className="text-[14px] text-neutral-800 flex items-center gap-1 truncate"
                >
                  <span>{emoji}</span>
                  <span>{clean}</span>
                </div>
              );
            });

            const status = (() => {
              if (sessions.some((s) => completed[`${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`] === 'done')) return 'done';
              if (sessions.some((s) => completed[`${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`] === 'skipped')) return 'skipped';
              return sessions.length ? 'planned' : null;
            })();

            const statusColor = status === 'done' ? 'bg-green-500'
              : status === 'skipped' ? 'bg-yellow-400'
              : status === 'planned' ? 'bg-sky-400'
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
                  relative bg-white border border-gray-200 rounded-xl px-4 py-4 cursor-pointer flex flex-col justify-start min-h-[140px]
                  transition-transform hover:scale-[1.01] hover:shadow-md
                  ${isToday ? 'ring-2 ring-black/10' : ''}
                `}
              >
                <div className="text-xs text-neutral-500 font-medium mb-2 leading-tight text-center">
                  <div className="uppercase text-[10px]">{format(parseISO(date), 'MMM')}</div>
                  <div className="text-[14px] font-semibold">{format(parseISO(date), 'd')}</div>
                </div>
                {sessionElements.length ? sessionElements : <span className="text-[14px] text-neutral-400">🧘 Rest Day</span>}
                {statusColor && <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${statusColor}`} />}
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