import { useMemo, useEffect, useRef } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays, isBefore } from 'date-fns';

interface RichCalendarViewProps {
  plan: any[];
  completed: { [key: string]: string };
  stravaActivities: any[];
}

export default function RichCalendarView({ plan, completed, stravaActivities }: RichCalendarViewProps) {
  const today = new Date();
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!containerRef.current) return;

    const currentWeekIndex = calendarRange.findIndex((week) =>
      week.some((date) => format(today, 'yyyy-MM-dd') === date)
    );

    if (currentWeekIndex !== -1) {
      const target = containerRef.current.querySelector(`#week-${currentWeekIndex}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [calendarRange]);

  return (
    <div className="w-full max-w-7xl mx-auto overflow-x-auto" ref={containerRef}>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Your Training Plan</h1>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-sm text-gray-600 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {calendarRange.map((week, weekIdx) => (
        <div
          key={weekIdx}
          id={`week-${weekIdx}`}
          className="grid grid-cols-7 gap-2 mb-4"
        >
          {week.map((date) => {
            const dateObj = parseISO(date);
            const isToday = isSameDay(dateObj, today);
            const inPast = isBefore(dateObj, today);
            const fadeClass = '';

            return (
              <div
                key={date}
                className={`min-h-[100px] border rounded-lg p-2 text-left text-xs bg-white shadow-sm flex flex-col gap-1 ${
                  isToday ? 'border-black' : 'border-gray-200'
                } ${fadeClass}`}
              >
                <div className="text-[10px] text-gray-400 font-semibold mb-1">
                  {format(dateObj, 'MMM d')}
                </div>
                {(sessionsByDate[date] || []).map((s, i) => {
                  const status = completed[
                    `${date}-${s.toLowerCase().includes('swim')
                      ? 'swim'
                      : s.toLowerCase().includes('bike')
                      ? 'bike'
                      : 'run'}`
                  ];
                  const color =
                    status === 'done'
                      ? 'text-green-700'
                      : status === 'skipped'
                      ? 'text-gray-400 line-through'
                      : 'text-blue-700';
                  return (
                    <div key={i} className={`${color}`}>{s}</div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
