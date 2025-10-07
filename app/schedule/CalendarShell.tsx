'use client';

import { useEffect, useState } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

// Align with DB schema: completed sessions store the date in a `date` column.
type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type CalendarShellProps = {
  sessionsByDate: Record<string, MergedSession[]>;
  completedSessions: CompletedSession[];
  stravaByDate: Record<string, StravaActivity[]>;
  unmatchedActivities?: StravaActivity[];
  onCompletedUpdate?: (updated: CompletedSession[]) => void;
  timezone?: string;
};

function SupportBanner() {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  return (
    <button
      onClick={handleClick}
      className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 transition"
    >
      <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400" />
      <span className="text-gray-600 underline hover:text-gray-800">
        Support the project ($5/month)
      </span>
    </button>
  );
}

export default function CalendarShell({
  sessionsByDate,
  completedSessions,
  stravaByDate,
  unmatchedActivities = [],
  onCompletedUpdate,
  timezone = 'America/Los_Angeles',
}: CalendarShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [completed, setCompleted] = useState<CompletedSession[]>(completedSessions);
  const [data, setData] = useState<Record<string, MergedSession[]>>(sessionsByDate);

  // Detect screen size
  useEffect(() => {
    setHasMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!hasMounted) return null;

  // Handle new session addition (from InlineSessionForm)
  const handleSessionAdded = (session: MergedSession) => {
    setData((prev) => ({
      ...prev,
      [session.date]: [...(prev[session.date] || []), session],
    }));
  };

  const handleSessionClick = (session: MergedSession) => setSelectedSession(session);
  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 max-w-[1800px] mx-auto">
      {isMobile ? (
        <MobileCalendarView
          sessions={Object.values(data).flat()}
          completedSessions={completed}
        />
      ) : (
        <>
          <SupportBanner />

          <div className="flex items-center justify-between mb-6 w-full">
            <button onClick={goToPrevMonth} className="text-sm text-gray-500 hover:text-black">
              ←
            </button>
            <h2 className="text-2xl font-semibold text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button onClick={goToNextMonth} className="text-sm text-gray-500 hover:text-black">
              →
            </button>
          </div>

          <MonthGrid
            currentMonth={currentMonth}
            sessionsByDate={data}
            completedSessions={completed}
            stravaByDate={stravaByDate}
            onSessionClick={handleSessionClick}
            onSessionAdded={handleSessionAdded}
            
            
            
          />
        </>
      )}

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        completedSessions={completed}
        onCompletedUpdate={(updatedList) => {
          setCompleted(updatedList);
          onCompletedUpdate?.(updatedList);
        }}
      />
    </main>
  );
}
