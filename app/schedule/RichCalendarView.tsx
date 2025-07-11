// Award-worthy: RichCalendarViewV2.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  isSameDay,
  startOfWeek,
  addDays,
} from 'date-fns';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { SessionModal } from './SessionModal';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMOJIS: Record<string, string> = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
  rest: '🧘',
  strava: '📈',
};

const getEmoji = (s: string) => {
  const lower = s.toLowerCase();
  if (lower.includes('swim')) return EMOJIS.swim;
  if (lower.includes('bike')) return EMOJIS.bike;
  if (lower.includes('run')) return EMOJIS.run;
  if (lower.includes('strava')) return EMOJIS.strava;
  return EMOJIS.rest;
};

const getStatusColor = (date: string, sessions: string[], completed: Record<string, string>) => {
  const statuses = sessions.map((s) => {
    const key = `${date}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`;
    return completed[key];
  });
  if (statuses.includes('done')) return 'bg-green-500';
  if (statuses.includes('skipped')) return 'bg-yellow-400';
  if (sessions.length) return 'bg-cyan-500';
  return '';
};

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
  const [monthIndex, setMonthIndex] = useState(0);
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
    stravaActivities.forEach((a) => {
      const date = a.start_date_local.split('T')[0];
      const sport = a.sport_type.toLowerCase();
      const mapped = sport === 'ride' || sport === 'virtualride' ? 'bike' : sport;
      const mins = Math.round(a.moving_time / 60);
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

  const handleGenerateDetailedWorkout = async (session: any) => {
    const key = `${session.date}-${session.title}`;
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
    <div className="w-full max-w-[1600px] mx-auto px-8 py-12 bg-[#f7f8fa] rounded-3xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-neutral-900">Your Training Plan</h2>
          <p className="text-sm text-neutral-600">Click a session for AI-generated details</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">
            {format(parseISO(visibleWeeks[0][0]), 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >← Prev</button>
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button
              onClick={() => setMonthIndex((prev) => prev + 1)}
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >Next →</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[13px] text-neutral-500 mb-4">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>

      {visibleWeeks.map((week, i) => (
        <div key={i} className="grid grid-cols-7 gap-4 mb-6">
          {week.map((date) => {
            const sessions = sessionsByDate[date] || [];
            const isToday = isSameDay(parseISO(date), today);
            const statusColor = getStatusColor(date, sessions, completed);
            const displaySessions = sessions.slice(0, 3);

            return (
              <div
                key={date}
                className={clsx(
                  'relative bg-white border border-neutral-200 rounded-xl px-4 py-4 cursor-pointer min-h-[140px] flex flex-col justify-start hover:shadow-md hover:scale-[1.01] transition-transform',
                  isToday && 'ring-2 ring-black/10'
                )}
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
              >
                <div className="text-[12px] font-medium text-neutral-500 mb-1 text-center">
                  <div className="uppercase text-[11px]">{format(parseISO(date), 'MMM')}</div>
                  <div>{format(parseISO(date), 'd')}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {displaySessions.length ? displaySessions.map((s, i) => (
                    <div key={i} className="text-[14px] text-neutral-800 flex items-center gap-1 truncate">
                      <span>{getEmoji(s)}</span>
                      <span className="truncate">{s.replace(/^(🏊|🚴|🏃|📋)?\s?\w+(:)?\s?/, '').trim()}</span>
                    </div>
                  )) : (
                    <div className="text-[14px] text-neutral-400 flex items-center gap-1">
                      <span>{EMOJIS.rest}</span>
                      <span>Rest day</span>
                    </div>
                  )}
                </div>
                {statusColor && <span className={clsx('absolute top-3 right-3 w-2 h-2 rounded-full', statusColor)} />}
              </div>
            );
          })}
        </div>
      ))}

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
