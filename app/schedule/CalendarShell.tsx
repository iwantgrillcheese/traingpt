// /app/schedule/CalendarShell.tsx
'use client';

import { useEffect, useState } from 'react';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import type { Session } from '@/types/session';

type CalendarShellProps = {
  sessions: Session[];
};

export default function CalendarShell({ sessions }: CalendarShellProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-background">
      {isMobile ? (
        <MobileCalendarView sessions={sessions} />
      ) : (
        <MonthGrid sessions={sessions} />
      )}
    </main>
  );
}
