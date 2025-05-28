import { useState, useMemo } from 'react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';

interface MobileCalendarViewProps {
  plan: any[];
  completed: { [key: string]: string };
  stravaActivities: any[];
}

export default function MobileCalendarView({ plan, completed, stravaActivities }: MobileCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const today = new Date();

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

  const calendarDays = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const displayDate = (date: Date) => format(date, 'yyyy-MM-dd');
  const isToday = (date: Date) => isSameDay(date, today);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const sessionsForSelected = sessionsByDate[displayDate(selectedDate)] || [];

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-600 mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-6">
        {calendarDays.map((date) => {
          const dateStr = displayDate(date);
          const hasSession = sessionsByDate[dateStr]?.length > 0;
          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(date)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium ${
                isSameDay(date, selectedDate)
                  ? 'bg-black text-white'
                  : isToday(date)
                  ? 'border border-black text-black'
                  : 'text-gray-700'
              }`}
            >
              {format(date, 'd')}
              {hasSession && <div className="absolute w-1 h-1 bg-blue-500 rounded-full mt-6" />}
            </button>
          );
        })}
      </div>

      <div className="mb-4 px-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {format(selectedDate, 'EEEE, MMM d')}
        </h3>
        <ul className="space-y-2">
          {sessionsForSelected.length === 0 && (
            <li className="text-gray-400 italic">No sessions</li>
          )}
          {sessionsForSelected.map((s, i) => {
            const key = `${displayDate(selectedDate)}-${s.toLowerCase().includes('swim') ? 'swim' : s.toLowerCase().includes('bike') ? 'bike' : 'run'}`;
            const status = completed[key];
            const color =
              status === 'done' ? 'text-green-700' :
              status === 'skipped' ? 'text-gray-400 line-through' :
              'text-blue-700';
            return <li key={i} className={`${color} text-sm`}>{s}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}
