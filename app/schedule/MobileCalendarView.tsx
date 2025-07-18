// /app/schedule/MobileCalendarView.tsx
'use client';

import { useMemo, useState } from 'react';
import { format, isAfter, isSameDay, parseISO, startOfWeek, addDays } from 'date-fns';
import type { Session } from '@/types/session';
import { useRouter } from 'next/navigation';

type MobileCalendarViewProps = {
  sessions: Session[];
};

type Week = {
  start: Date;
  days: Date[];
};

export default function MobileCalendarView({ sessions }: MobileCalendarViewProps) {
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(0);
  const router = useRouter();

  const weeks: Week[] = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 8 }, (_, i) => {
      const startOfThisWeek = addDays(start, i * 7);
      return {
        start: startOfThisWeek,
        days: Array.from({ length: 7 }, (_, j) => addDays(startOfThisWeek, j)),
      };
    });
  }, []);

  const handleSessionClick = (session: Session, date: Date) => {
    const query = `?q=Can you explain the ${session.title} on ${format(date, 'EEEE')}?`;
    router.push(`/coaching${query}`);
  };

  return (
    <div className="space-y-4">
      {weeks.map((week, idx) => {
        const label = `${format(week.start, 'MMM d')} – ${format(week.days[6], 'MMM d')}`;
        const isPast = isAfter(new Date(), addDays(week.start, 6));

        return (
          <div key={idx} className="border rounded-md overflow-hidden">
            <button
              className="w-full text-left px-4 py-2 bg-muted font-medium"
              onClick={() => setExpandedWeekIndex(expandedWeekIndex === idx ? null : idx)}
            >
              {label}
            </button>

            {expandedWeekIndex === idx && (
              <div className="p-2 space-y-2">
                {week.days.map((date) => {
                  const daySessions = sessions.filter((s) =>
                    isSameDay(parseISO(s.date), date)
                  );

                  return (
                    <div key={date.toISOString()}>
                      <div className="text-sm font-semibold mb-1">{format(date, 'EEEE, MMM d')}</div>
                      {daySessions.length > 0 ? (
                        <div className="space-y-1">
                          {daySessions.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => handleSessionClick(s, date)}
                              className="w-full text-left text-sm px-3 py-2 bg-muted rounded hover:bg-accent"
                            >
                              {s.title}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm px-3">No sessions</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
