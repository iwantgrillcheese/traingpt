'use client';

import { useEffect, useState } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import type { Session } from '@/types/session';

type CalendarShellProps = {
  sessions: Session[];
};

export default function CalendarShell({ sessions }: CalendarShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
  };

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <main className="min-h-screen bg-background flex flex-col gap-4 p-4 md:p-8">
      {!isMobile && (
        <div className="flex items-center justify-between mb-2">
          <button onClick={goToPrevMonth} className="text-sm text-gray-600 hover:text-black">
            ←
          </button>
          <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={goToNextMonth} className="text-sm text-gray-600 hover:text-black">
            →
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isMobile ? (
          <MobileCalendarView sessions={sessions} />
        ) : (
          <MonthGrid
  sessions={sessions}
  onSessionClick={handleSessionClick} // <-- this matters
  currentMonth={currentMonth}
/>
        )}
      </div>

      <SessionModal
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </main>
  );
}
