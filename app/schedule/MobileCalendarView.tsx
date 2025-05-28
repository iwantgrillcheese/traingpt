import { useMemo, useState } from 'react';
import { format, parseISO, isSameDay, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

export default function MobileCalendarView({ plan, completed, stravaActivities }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const sessionsByDate = useMemo(() => {
    const sessions: Record<string, string[]> = {};

    plan.forEach((week: any) => {
      Object.entries(week.days).forEach(([date, raw]) => {
        const items = raw as string[];
        if (!sessions[date]) sessions[date] = [];
        sessions[date].push(...items);
      });
    });

    stravaActivities.forEach((activity: any) => {
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

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);

  const calendarDays = useMemo(() => {
    const days = [];
    const date = new Date(start);
    date.setDate(date.getDate() - date.getDay());

    while (date <= end || days.length < 42) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const getSessionStatus = (date: string, label: string) => {
    const key = `${date}-${label.toLowerCase().includes('swim') ? 'swim' : label.toLowerCase().includes('bike') ? 'bike' : 'run'}`;
    return completed[key];
  };

  const getDotColor = (date: string) => {
    const sessions = sessionsByDate[date] || [];
    if (sessions.some(s => getSessionStatus(date, s) === 'done')) return 'bg-green-500';
    if (sessions.some(s => getSessionStatus(date, s) === 'skipped')) return 'bg-gray-400';
    if (sessions.length > 0) return 'bg-blue-500';
    return '';
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>&larr;</button>
        <h2 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>&rarr;</button>
      </div>
      <div className="grid grid-cols-7 text-center font-medium text-sm text-gray-600 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const dotColor = getDotColor(dateStr);

          return (
            <div
              key={idx}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center py-1 rounded-full cursor-pointer ${isSelected ? 'bg-black text-white' : 'text-gray-800'}`}
            >
              <div>{format(day, 'd')}</div>
              <div className={`w-1.5 h-1.5 rounded-full mt-1 ${dotColor}`}></div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-gray-600 mb-1">
          {format(selectedDate, 'EEEE, MMMM d')}
        </div>
        <div className="flex flex-col gap-2">
          {(sessionsByDate[format(selectedDate, 'yyyy-MM-dd')] || []).map((s: string, i: number) => {
            const status = getSessionStatus(format(selectedDate, 'yyyy-MM-dd'), s);
            const color = status === 'done' ? 'text-green-700' : status === 'skipped' ? 'text-gray-400 line-through' : 'text-blue-700';
            return <div key={i} className={`${color}`}>{s}</div>;
          })}
        </div>
      </div>
    </div>
  );
}
