'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-background">
      {isMobile ? (
        <MobileCalendarView sessions={sessions} />
      ) : (
        <MonthGrid sessions={sessions} onSessionClick={handleSessionClick} />
      )}

      <SessionModal
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </main>
  );
}
