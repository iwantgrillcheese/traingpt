// FINALIZED: RichCalendarView.tsx — Fantastical-style Flat UI Calendar
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

  const getTopBarColor = (session: string) => {
    const s = session.toLowerCase();
    if (s.includes('swim')) return 'bg-cyan-300';
    if (s.includes('bike')) return 'bg-orange-300';
    if (s.includes('run')) return 'bg-pink-300';
    return 'bg-neutral-300';
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Your Training Plan</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-600">
            {format(parseISO(visibleWeeks[0][0]), 'MMMM yyyy')}
          </span>
          {monthIndex > 0 && (
            <button onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))} className="text-neutral-500 hover:text-black">← Prev</button>
          )}
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button onClick={() => setMonthIndex((prev) => prev + 1)} className="text-neutral-500 hover:text-black">Next →</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-neutral-400 uppercase mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
      </div>

      {visibleWeeks.map((week, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-[1px] bg-neutral-200 mb-[1px]">
          {week.map((date) => {
            const sessions = sessionsByDate[date] || [];
            const isToday = isSameDay(parseISO(date), today);
            const statusColor = getStatusColor(date, sessions);

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
                className={`border border-neutral-200 rounded-md shadow-sm bg-white hover:bg-neutral-50 hover:ring-1 hover:ring-neutral-300 px-4 py-2 text-left min-h-[100px] relative cursor-pointer transition duration-150 ease-in-out`}
              >
                <div className="text-[10px] text-neutral-400 uppercase font-medium mb-1">
                  {format(parseISO(date), 'MMM d')}
                </div>

                {sessions.slice(0, 3).map((s, i) => (
                  <div
                    key={i}
                    className="relative pl-3 text-sm text-neutral-700 mb-1 border-l-4"
                    style={{ borderColor: getTopBarColor(s).replace('bg-', '') }}
                  >
                    {cleanLabel(s)}
                  </div>
                ))}

                {sessions.length === 0 && (
                  <div className="text-[11px] text-neutral-400">Rest day</div>
                )}

                {sessions.length > 3 && (
                  <div className="text-[10px] text-neutral-400 mt-1">+{sessions.length - 3} more</div>
                )}

                {statusColor && <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${statusColor}`} />}
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
