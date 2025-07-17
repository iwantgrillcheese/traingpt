'use client';

import { useState, useMemo } from 'react';
import RichCalendarView from './RichCalendarView';
import { SidebarCalendar } from './SidebarCalendar';
import { SessionModal } from './SessionModal';

export default function FantasticalCalendar({
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
  const [modalSession, setModalSession] = useState<any | null>(null);
  const [detailedWorkoutMap, setDetailedWorkoutMap] = useState<Record<string, string>>({});

  // Flatten plan + strava sessions into array for SidebarCalendar
  const flatSessions = useMemo(() => {
    const sessions: { date: string; title: string; sport?: string }[] = [];

    Object.entries(plan.days).forEach(([date, titles]) => {
      titles.forEach((title) => sessions.push({ date, title }));
    });

    stravaActivities.forEach((activity) => {
      const date = activity.start_date_local.split('T')[0];
      const sport = activity.sport_type.toLowerCase();
      const mapped = sport === 'ride' || sport === 'virtualride' ? 'bike' : sport;
      const mins = Math.round(activity.moving_time / 60);
      const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${mins}min (Strava)`;
      sessions.push({ date, title: label, sport: mapped });
    });

    return sessions;
  }, [plan.days, stravaActivities]);

  const handleGenerateWorkout = async (session: any) => {
    const key = `${session.date}-${session.title}`;
    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: session.title, date: session.date }),
    });

    const { workout } = await res.json();
    setDetailedWorkoutMap((prev) => ({ ...prev, [key]: workout }));
    setModalSession((prev: any) => ({ ...prev, aiWorkout: workout }));
  };

  return (
    <div className="flex w-full max-w-screen-xl mx-auto px-6 py-10 gap-6">
      <SidebarCalendar sessions={flatSessions} selectedDate={new Date()} onSelectDate={function (date: Date): void {
        throw new Error('Function not implemented.');
      } } />

      <RichCalendarView
  plan={plan}
  completed={completed}
  stravaActivities={stravaActivities}
/>


      {modalSession && (
        <SessionModal
          session={modalSession}
          onClose={() => setModalSession(null)}
          onGenerateWorkout={() => handleGenerateWorkout(modalSession)}
        />
      )}
    </div>
  );
}
