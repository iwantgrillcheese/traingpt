import { useMemo, useState } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays, isBefore, isAfter } from 'date-fns';

interface Props {
  plan: any[];
  completed: { [key: string]: string };
  stravaActivities: any[];
}

export default function RichCalendarView({ plan, completed, stravaActivities }: Props) {
  const today = new Date();
  const [monthIndex, setMonthIndex] = useState(0);

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

  const visibleWeeks = calendarRange.slice(monthIndex * 4, (monthIndex + 1) * 4);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Your Training Plan</h2>
        <div className="flex gap-2">
          {monthIndex > 0 && (
            <button onClick={() => setMonthIndex(monthIndex - 1)} className="text-sm px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200">
              ← Previous
            </button>
          )}
          {(monthIndex + 1) * 4 < calendarRange.length && (
            <button onClick={() => setMonthIndex(monthIndex + 1)} className="text-sm px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200">
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-sm text-gray-600 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {visibleWeeks.map((week, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-2 mb-4">
          {week.map((date) => (
            <div
              key={date}
              className={`min-h-[100px] border rounded-lg p-2 text-left text-xs bg-white shadow-sm flex flex-col gap-1 ${
                isSameDay(parseISO(date), today) ? 'border-black' : 'border-gray-200'
              }`}
            >
              <div className="text-[10px] text-gray-400 font-semibold mb-1">
                {format(parseISO(date), 'MMM d')}
              </div>

              {(sessionsByDate[date] || []).map((s, i) => {
                const status = completed[
                  `${date}-$
                    {
                      s.toLowerCase().includes('swim')
                        ? 'swim'
                        : s.toLowerCase().includes('bike')
                        ? 'bike'
                        : 'run'
                    }`
                ];
                const color =
                  status === 'done'
                    ? 'text-green-700'
                    : status === 'skipped'
                    ? 'text-gray-400 line-through'
                    : 'text-blue-700';
                return (
                  <div key={i} className={`${color} truncate`} title={s}>
                    {s}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
