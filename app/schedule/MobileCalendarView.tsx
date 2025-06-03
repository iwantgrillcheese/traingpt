'use client';

import { generateCoachQuestion } from '@/utils/generateCoachQuestion';
import { Session } from '@/types/session';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  addMonths,
  subMonths,
  addDays,
} from 'date-fns';

// Augmented display-only type
type DisplaySession = Session & {
  isStravaOnly?: boolean;
  duration?: number;
};

type Props = {
  sessions: Session[];
  stravaActivities: any[];
};

export default function MobileCalendarView({ sessions, stravaActivities }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailedWorkouts, setDetailedWorkouts] = useState<Record<string, string>>({});
  const router = useRouter();

  const sessionsByDate = useMemo(() => {
    const byDate: Record<string, DisplaySession[]> = {};

    // Add regular sessions
    sessions.forEach((session) => {
      if (!byDate[session.date]) byDate[session.date] = [];
      byDate[session.date].push(session);
    });

    // Add synthetic Strava sessions
    stravaActivities.forEach((activity: any) => {
      const date = activity.start_date_local.split('T')[0];
      const sport = activity.sport_type?.toLowerCase();
      const mapped = sport === 'ride' || sport === 'virtualride' ? 'bike' : sport;
      const mins = Math.round(activity.moving_time / 60);
      const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${mins}min (Strava)`;

      const syntheticSession: DisplaySession = {
        id: `strava-${activity.id || label}-${date}`,
        user_id: 'strava',
        plan_id: 'strava',
        date,
        sport: mapped,
        label,
        status: 'done',
        structured_workout: null,
        isStravaOnly: true,
        duration: mins,
      };

      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(syntheticSession);
    });

    return byDate;
  }, [sessions, stravaActivities]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const startDayOffset = start.getDay();
    const calendarStart = new Date(start);
    calendarStart.setDate(start.getDate() - startDayOffset);
    return Array.from({ length: 35 }, (_, i) => addDays(calendarStart, i));
  }, [currentMonth]);

  const getEmoji = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('swim')) return '🏊';
    if (lower.includes('bike')) return '🚴';
    if (lower.includes('run')) return '🏃';
    return '📋';
  };

  const handleGenerateWorkout = async (title: string, date: string) => {
    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date }),
    });
    const { workout } = await res.json();
    const key = `${date}-${title}`;
    setDetailedWorkouts((prev) => ({ ...prev, [key]: workout }));
  };

  const handleSessionClick = (dateStr: string, label: string) => {
    const question = generateCoachQuestion(format(parseISO(dateStr), 'MMMM d'), label);
    router.push(`/coaching?q=${encodeURIComponent(question)}`);
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedSessions = sessionsByDate[selectedDateStr] || [];

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-10">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-sm text-gray-500 hover:text-black"
        >
          ←
        </button>
        <h2 className="font-semibold text-base tracking-tight">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-sm text-gray-500 hover:text-black"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 text-center font-medium text-xs text-gray-400 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-sm">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const sessions = sessionsByDate[dateStr] || [];

          const dotColor = (() => {
            if (sessions.some((s) => s.status === 'done')) return 'bg-green-500';
            if (sessions.some((s) => s.status === 'skipped')) return 'bg-gray-400';
            if (sessions.length > 0) return 'bg-blue-500';
            return '';
          })();

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center justify-center rounded-lg py-2 transition-all ${
                isSelected
                  ? 'bg-black text-white font-medium shadow'
                  : 'text-gray-700 hover:bg-neutral-100'
              }`}
            >
              <div>{format(day, 'd')}</div>
              <div className={`w-1.5 h-1.5 rounded-full mt-1 ${dotColor}`}></div>
            </button>
          );
        })}
      </div>

      {selectedSessions.length > 0 && (
        <div className="mt-8 bg-white border border-neutral-200 rounded-xl shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-600 mb-3">
            {format(selectedDate, 'EEEE, MMMM d')}
          </div>

          <div className="flex flex-col gap-4 text-sm">
            {selectedSessions.map((s, i) => {
              const key = `${s.date}-${s.label}`;
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span>{getEmoji(s.label)}</span>
                    <span
                      onClick={() => handleSessionClick(s.date, s.label)}
                      className="text-blue-600 underline cursor-pointer"
                    >
                      {s.label.replace(/^\w+: /, '')}
                    </span>
                  </div>
                  {detailedWorkouts[key] ? (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-md p-2 text-[13px] whitespace-pre-wrap">
                      {detailedWorkouts[key]}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateWorkout(s.label, s.date)}
                      className="self-start text-xs text-blue-600 underline"
                    >
                      Generate detailed workout
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <textarea
            placeholder="Leave a note..."
            className="mt-4 w-full border border-neutral-300 rounded-md p-2 text-sm"
            rows={3}
          />

          <div className="flex justify-end gap-3 mt-4">
            <button className="text-sm text-gray-500">Skip</button>
            <button className="bg-black text-white text-sm px-4 py-2 rounded-md">Mark Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
