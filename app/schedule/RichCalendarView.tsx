// FINALIZED: RichCalendarView.tsx — Fantastical-style UI with Sidebar
'use client';

import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isSameMonth,
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
  plan: any[];
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [detailedWorkoutMap, setDetailedWorkoutMap] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(startOfMonth(new Date()));

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

  const daysInView = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const days = [];
    let curr = start;
    while (days.length < 35) {
      days.push(curr);
      curr = addDays(curr, 1);
    }
    return days;
  }, [month]);

  const cleanLabel = (title: string) => title.replace(/^(🏊|🚴|🏃|📋)?\s?\w+(:)?\s?/, '').trim();

  const getTopBarColor = (session: string) => {
    const s = session.toLowerCase();
    if (s.includes('swim')) return 'bg-cyan-300';
    if (s.includes('bike')) return 'bg-orange-300';
    if (s.includes('run')) return 'bg-pink-300';
    return 'bg-neutral-300';
  };

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
    <div className="flex flex-col lg:flex-row max-w-7xl mx-auto px-6 py-10 gap-8">
      {/* Sidebar */}
      <div className="w-full lg:w-72 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">{format(month, 'MMMM yyyy')}</h2>
          <div className="grid grid-cols-7 text-xs text-neutral-300 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
              <div key={d} className="text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {daysInView.map((date) => {
              const key = format(date, 'yyyy-MM-dd');
              const hasSession = sessionsByDate[key]?.length > 0;
              return (
                <div
                  key={key}
                  className={`text-xs text-center rounded-full p-1 ${isToday(date) ? 'bg-white text-black font-semibold' : 'text-neutral-400'} ${hasSession ? 'border border-white/20' : ''}`}
                >
                  {format(date, 'd')}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-sm text-neutral-100">
          <h3 className="font-semibold mb-2">Upcoming</h3>
          {daysInView.map((date) => {
            const key = format(date, 'yyyy-MM-dd');
            const sessions = sessionsByDate[key] || [];
            if (!sessions.length || !isSameMonth(date, month)) return null;
            return (
              <div key={key} className="mb-1">
                <div className="text-xs text-neutral-400">{format(date, 'eee MMM d')}</div>
                <ul className="list-disc ml-4">
                  {sessions.slice(0, 2).map((s, i) => (
                    <li key={i}>{s.length > 35 ? s.slice(0, 32) + '…' : s}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Month Grid */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-neutral-900">Your Training Plan</h2>
          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="text-neutral-500 hover:text-black">← Prev</button>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="text-neutral-500 hover:text-black">Next →</button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-neutral-400 uppercase mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[1px] bg-neutral-200">
          {daysInView.map((date) => {
            const key = format(date, 'yyyy-MM-dd');
            const sessions = sessionsByDate[key] || [];
            return (
              <div
                key={key}
                className={`bg-white px-2 py-2 text-left min-h-[100px] relative ${!isSameMonth(date, month) ? 'text-neutral-300' : 'text-black'} cursor-pointer hover:bg-neutral-50`}
                onClick={() => {
                  const first = sessions[0];
                  if (!first) return;
                  const sessionType = first.toLowerCase().includes('swim')
                    ? 'swim'
                    : first.toLowerCase().includes('bike')
                    ? 'bike'
                    : 'run';

                  setActiveSession({
                    date: key,
                    title: first,
                    status: completed[`${key}-${sessionType}`],
                    aiWorkout: detailedWorkoutMap[key] || null,
                    userNote: '',
                  });
                }}
              >
                <div className="text-[10px] text-neutral-400 uppercase font-medium mb-1">
                  {format(date, 'MMM d')}
                </div>

                {sessions.slice(0, 3).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center text-xs truncate relative pl-2 border-l-4 mb-1"
                    style={{ borderColor: getTopBarColor(s).replace('bg-', '') }}
                  >
                    {s.length > 30 ? s.slice(0, 27) + '…' : s}
                  </div>
                ))}

                {sessions.length > 3 && (
                  <div className="text-[10px] text-neutral-400 mt-1">+{sessions.length - 3} more</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
