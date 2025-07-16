'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import SessionModal from './SessionModal';

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
  const today = new Date();
  const router = useRouter();
  const [monthIndex, setMonthIndex] = useState(0);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [detailedWorkoutMap, setDetailedWorkoutMap] = useState<Record<string, string>>({});

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

  const calendarRange = useMemo(() => {
    const allDates = Object.keys(sessionsByDate).sort();
    if (!allDates.length) return [];
    const start = startOfWeek(parseISO(allDates[0]), { weekStartsOn: 1 });
    const end = parseISO(allDates[allDates.length - 1]);
    const weeks = [];
    let curr = start;

    while (curr <= end) {
      const week = Array.from({ length: 7 }).map((_, i) =>
        format(addDays(curr, i), 'yyyy-MM-dd')
      );
      weeks.push(week);
      curr = addDays(curr, 7);
    }
    return weeks;
  }, [sessionsByDate]);

  const visibleWeeks = calendarRange.slice(monthIndex * 4, monthIndex * 4 + 4);

  const cleanLabel = (title: string) => title.replace(/^\w+(:)?\s?/, '').trim();

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
    <div className="w-full max-w-[1400px] mx-auto px-6 py-10 bg-neutral-50 rounded-3xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-800">Your Training Plan</h2>
        <div className="flex gap-4 text-sm">
          {monthIndex > 0 && (
            <button
              className="text-gray-500 hover:text-black"
              onClick={() => setMonthIndex((prev) => Math.max(prev - 1, 0))}
            >
              ← Prev
            </button>
          )}
          {calendarRange.length > (monthIndex + 1) * 4 && (
            <button
              className="text-gray-500 hover:text-black"
              onClick={() => setMonthIndex((prev) => prev + 1)}
            >
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

      <div
        className="overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="inline-flex gap-6 px-2">
          {visibleWeeks.map((week, idx) => (
            <div
              key={idx}
              className="grid grid-cols-7 gap-4 min-w-[600px] bg-white rounded-xl p-4 snap-start"
            >
              {week.map((date) => (
                <div
                  key={date}
                  onClick={() => {
                    const first = sessionsByDate[date]?.[0];
                    if (!first) return;
                    const key = `${date}-${cleanLabel(first)}`;
                    setActiveSession({
                      date,
                      title: first,
                      status:
                        completed[
                          `${date}-${
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
                  className={`min-h-[110px] bg-white rounded-2xl p-3 text-[13px] leading-tight border ${
                    isSameDay(parseISO(date), today) ? 'border-black' : 'border-neutral-200'
                  } shadow-sm hover:shadow-md hover:ring-1 hover:ring-neutral-200/60 transition-all cursor-pointer flex flex-col gap-1`}
                >
                  <div className="text-[11px] font-medium text-neutral-400 tracking-wide">
                    {format(parseISO(date), 'MMM d')}
                  </div>
                  {(sessionsByDate[date] || []).map((s, i) => (
                    <div key={i} className="text-neutral-800 flex items-start gap-1">
                      <span>{cleanLabel(s)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
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
