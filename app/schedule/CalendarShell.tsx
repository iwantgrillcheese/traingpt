'use client';

import { useEffect, useState } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

type CalendarShellProps = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  stravaActivities: StravaActivity[];
  extraStravaActivities?: StravaActivity[];
  timezone?: string;
};

export default function CalendarShell({
  sessions,
  completedSessions,
  stravaActivities,
  extraStravaActivities = [],
  timezone = 'America/Los_Angeles',
}: CalendarShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    setHasMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!hasMounted) return null;

  const sessionsByDate: Record<string, MergedSession[]> = {};
  sessions.forEach((s) => {
    if (!s.date) return;
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  });

  const normalizedStrava = normalizeStravaActivities(
    [...stravaActivities, ...extraStravaActivities],
    timezone
  );

  const stravaByDate: Record<string, StravaActivity[]> = {};
  normalizedStrava.forEach((a) => {
    const dateStr = a.local_date;
    if (!dateStr) return;
    if (!stravaByDate[dateStr]) stravaByDate[dateStr] = [];
    stravaByDate[dateStr].push(a);
  });

  const handleSessionClick = (session: MergedSession) => setSelectedSession(session);
  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 max-w-[1800px] mx-auto">
      {isMobile ? (
        <MobileCalendarView
          sessions={sessions}
          completedSessions={completedSessions}
        />
      ) : (
        <>

<div className="mb-6 w-full flex justify-center">
  <a
  href="/api/stripe/checkout"
  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-black transition"
>
  🙌 Has TrainGPT been helpful? Support the project ($5/month)
</a>

</div>

          <div className="flex items-center justify-between mb-6 w-full">
            <button onClick={goToPrevMonth} className="text-sm text-gray-500 hover:text-black">←</button>
            <h2 className="text-2xl font-semibold text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={goToNextMonth} className="text-sm text-gray-500 hover:text-black">→</button>
          </div>

          <MonthGrid
            currentMonth={currentMonth}
            sessionsByDate={sessionsByDate}
            completedSessions={completedSessions}
            stravaByDate={stravaByDate}
            onSessionClick={handleSessionClick}
          />
        </>
      )}

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </main>
  );
}
