'use client';

import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  isSameDay,
  startOfWeek,
  addDays,
} from 'date-fns';
import { useRouter } from 'next/navigation';
import { SessionModal } from './SessionModal';

export default function RichCalendarView({
  plan,
  completed,
  stravaActivities,
}: {
  plan: any[];
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const today = new Date();
  const router = useRouter();
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

  const [monthIndex, setMonthIndex] = useState(0);
  const visibleWeeks = calendarRange.slice(monthIndex * 4, monthIndex * 4 + 4);

  const cleanLabel = (title: string) => title.replace(/^(🏊|🚴|🏃|📋)?\s?\w+(:)?\s?/, '').trim();

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

  const getStatusColor = (date: string, sessions: string[]) => {
    const statuses = sessions.map((s) => {
      const key = `${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`;
      return completed[key];
    });
    if (statuses.includes('done')) return 'bg-green-500';
    if (statuses.includes('skipped')) return 'bg-yellow-400';
    if (sessions.length) return 'bg-sky-400';
    return '';
  };

  const getLabelStyle = (s: string) => {
    const lower = s.toLowerCase();
    if (lower.includes('swim')) return 'bg-sky-600 text-white';
    if (lower.includes('bike')) return 'bg-orange-500 text-white';
    if (lower.includes('run')) return 'bg-green-600 text-white';
    return 'bg-neutral-200 text-neutral-600';
  };

  const getLabelTitle = (s: string) => {
    const lower = s.toLowerCase();
    if (lower.includes('swim')) return 'SWIM';
    if (lower.includes('bike')) return 'BIKE';
    if (lower.includes('run')) return 'RUN';
    return 'REST DAY';
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 rounded-3xl shadow bg-white">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-neutral-900">Your Training Plan</h2>
          <p className="text-sm text-neutral-500 mt-1">Click a session for AI-generated details</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600 font-medium">
            {format(parseISO(visibleWeeks[0][0]), 'MMMM yyyy')}
          </span>
          {monthIndex > 0 && (
            <button onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))} className="text-sm text-neutral-400 hover:text-neutral-800">
              ← Prev
            </button>
          )}
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button onClick={() => setMonthIndex((prev) => prev + 1)} className="text-sm text-neutral-400 hover:text-neutral-800">
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[13px] text-neutral-400 uppercase mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
      </div>

      {visibleWeeks.map((week, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-3 mb-4">
          {week.map((date) => {
            const sessions = sessionsByDate[date] || [];
            const isToday = isSameDay(parseISO(date), today);

            const firstSession = sessions[0];
            const labelClass = getLabelStyle(firstSession || 'rest');
            const labelTitle = getLabelTitle(firstSession || 'rest');

            const clean = cleanLabel(firstSession || 'Rest day');
            const statusColor = getStatusColor(date, sessions);

            return (
              <div
                key={date}
                onClick={() => {
                  if (!firstSession) return;
                  const key = `${date}-${firstSession}`;
                  setActiveSession({
                    date,
                    title: firstSession,
                    status: completed[`${date}-${firstSession.toLowerCase().includes('swim') ? 'swim' : firstSession.toLowerCase().includes('bike') ? 'bike' : 'run'}`],
                    aiWorkout: detailedWorkoutMap[key] || null,
                    userNote: '',
                  });
                }}
                className={`relative bg-[#F9FAFB] border border-neutral-200 rounded-2xl px-4 py-4 min-h-[115px] cursor-pointer shadow-sm transition hover:shadow-md hover:scale-[1.015] flex flex-col justify-start items-start ${isToday ? 'ring-2 ring-black/10' : ''}`}
              >
                <div className="text-[11px] uppercase font-medium text-neutral-400 mb-2 tracking-wide">
                  {format(parseISO(date), 'MMM d')}
                </div>
                <div className={`text-[11px] font-semibold px-2 py-1 rounded-md mb-2 ${labelClass}`}>{labelTitle}</div>
                <div className="text-[13px] text-neutral-700 font-medium truncate max-w-[120px]">
                  {clean}
                </div>
                {statusColor && <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${statusColor}`} />}
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
              setDetailedWorkoutMap((prev) => ({ ...prev, [key]: activeSession.workout }));
            }
            setActiveSession(null);
          }}
          onGenerateWorkout={() => handleGenerateDetailedWorkout(activeSession)}
        />
      )}
    </div>
  );
}
