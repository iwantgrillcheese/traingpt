import { useMemo } from 'react';
import { format, parseISO, isSameDay, startOfWeek, addDays } from 'date-fns';

type PlanWeek = {
  days: Record<string, string[]>;
  label: string;
};

type StravaActivity = {
  start_date_local: string;
  sport_type: string;
  moving_time: number;
  name: string;
};

type Props = {
  plan: PlanWeek[];
  completed: Record<string, string>;
  stravaActivities: StravaActivity[];
};

export default function RichCalendarView({ plan, completed, stravaActivities }: Props) {
  const today = new Date();

  const sessionsByDate = useMemo<Record<string, string[]>>(() => {
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
      const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${mins}min`;
      if (!sessions[date]) sessions[date] = [];
      sessions[date].push(`${label} (Strava)`);
    });

    return sessions;
  }, [plan, stravaActivities]);

  const calendarRange = useMemo<string[][]>(() => {
    const allDates = Object.keys(sessionsByDate).sort();
    if (!allDates.length) return [];
    const start = startOfWeek(parseISO(allDates[0]), { weekStartsOn: 1 });
    const end = parseISO(allDates[allDates.length - 1]);
    const weeks: string[][] = [];
    let curr = start;

    while (curr <= end) {
      const week = Array.from({ length: 7 }).map((_, i) => format(addDays(curr, i), 'yyyy-MM-dd'));
      weeks.push(week);
      curr = addDays(curr, 7);
    }

    return weeks;
  }, [sessionsByDate]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-7 text-center font-medium text-sm text-gray-600 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {calendarRange.map((week, idx) => (
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
                  `${date}-${
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
                  <div key={i} className={`${color}`}>
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
