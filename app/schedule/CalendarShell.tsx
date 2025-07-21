'use client';

import { useEffect, useState } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

// 🧠 Add this inline or extract to a `useHasMounted.ts` file
function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  return hasMounted;
}

type EnrichedSession = Session & { stravaActivity?: StravaActivity };

type CalendarShellProps = {
  sessions: EnrichedSession[];
};

export default function CalendarShell({ sessions }: CalendarShellProps) {
  const hasMounted = useHasMounted(); // 🚨 prevent SSR mismatch
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!hasMounted) return null; // 🛑 Skip initial SSR render to prevent flicker

  const handleSessionClick = (session: EnrichedSession) => setSelectedSession(session);
  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 max-w-[1800px] mx-auto">
      {isMobile ? (
        <MobileCalendarView sessions={sessions} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6 w-full">
            <button onClick={goToPrevMonth} className="text-sm text-gray-500 hover:text-black">←</button>
            <h2 className="text-2xl font-semibold text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={goToNextMonth} className="text-sm text-gray-500 hover:text-black">→</button>
          </div>

          <MonthGrid
            sessions={sessions}
            onSessionClick={handleSessionClick}
            currentMonth={currentMonth}
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
