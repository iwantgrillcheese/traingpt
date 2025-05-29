'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { generateCoachQuestion } from '@/utils/generateCoachQuestion';
import { SessionModal } from './SessionModal';

export default function RichCalendarView({ plan, completed, stravaActivities }: {
  plan: any[];
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const today = new Date();
  const router = useRouter();
  const [monthIndex, setMonthIndex] = useState(0);
  const [activeSession, setActiveSession] = useState<any | null>(null);

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

  const getColorClass = (title: string, status: string | undefined) => {
    if (status === 'done') return 'text-green-600';
    if (status === 'skipped') return 'text-gray-400 line-through';
    if (title.toLowerCase().includes('swim')) return 'text-sky-600';
    if (title.toLowerCase().includes('bike')) return 'text-yellow-600';
    if (title.toLowerCase().includes('run')) return 'text-rose-600';
    if (title.toLowerCase().includes('strava')) return 'text-gray-500 italic';
    return 'text-neutral-700';
  };

  const getEmoji = (title: string) => {
    if (title.toLowerCase().includes('swim')) return '🏊';
    if (title.toLowerCase().includes('bike')) return '🚴';
    if (title.toLowerCase().includes('run')) return '🏃';
    return '📋';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 bg-neutral-50 min-h-screen py-8">
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
        <div key={idx} className="grid grid-cols-7 gap-3 mb-5">
          {week.map((date) => (
            <div
              key={date}
              onClick={() => {
                const first = sessionsByDate[date]?.[0];
                if (!first) return;
                setActiveSession({
                  date,
                  title: first,
                  status: completed[`${date}-${first.toLowerCase().includes('swim') ? 'swim' : first.toLowerCase().includes('bike') ? 'bike' : 'run'}`],
                  aiWorkout: null,
                  userNote: '',
                });
              }}
              className={`bg-white rounded-2xl p-3 text-[13px] leading-tight border ${
                isSameDay(parseISO(date), today)
                  ? 'border-black'
                  : 'border-neutral-200'
              } shadow-sm hover:shadow-md hover:ring-1 hover:ring-neutral-200/60 transition-all cursor-pointer flex flex-col gap-1`}
            >
              <div className="text-[11px] font-medium text-neutral-400 tracking-wide">
                {format(parseISO(date), 'MMM d')}
              </div>
              {(sessionsByDate[date] || []).map((s, i) => {
                const sportKey = s.toLowerCase().includes('swim')
                  ? 'swim'
                  : s.toLowerCase().includes('bike')
                  ? 'bike'
                  : 'run';
                const status = completed[`${date}-${sportKey}`];
                const color = getColorClass(s, status);
                return (
                  <div key={i} className={`${color} flex items-start gap-1`}>
                    <span>{getEmoji(s)}</span>
                    <span>{s.replace(/^\w+: /, '')}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      {activeSession && (
        <SessionModal
          session={activeSession}
          onClose={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}