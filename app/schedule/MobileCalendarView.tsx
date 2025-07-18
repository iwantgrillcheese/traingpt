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
        const isExpanded = expandedWeekIndex === idx;

        return (
          <div key={idx} className="border rounded-md overflow-hidden bg-background">
            <button
              onClick={() => setExpandedWeekIndex(isExpanded ? null : idx)}
              className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 transition-colors font-medium text-sm"
            >
              {label}
            </button>

            {isExpanded && (
              <div className="p-3 space-y-4">
                {week.days.map((date) => {
                  const daySessions = sessions.filter((s) =>
                    isSameDay(parseISO(s.date), date)
                  );

                  return (
                    <div key={date.toISOString()} className="space-y-2">
                      <div className="text-sm font-semibold text-foreground">
                        {format(date, 'EEEE, MMM d')}
                      </div>

                      {daySessions.length > 0 ? (
                        <div className="space-y-2">
                          {daySessions.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => handleSessionClick(s, date)}
                              className="block w-full text-left text-sm px-4 py-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition"
                            >
                              {s.title}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground px-1">No sessions</div>
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
