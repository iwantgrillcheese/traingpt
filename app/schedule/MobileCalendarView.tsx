'use client';

import { useMemo, useState } from 'react';
import { format, isSameDay, parseISO, startOfWeek, addDays } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@/types/session';
import { getSessionColor } from '@/utils/session-utils';
import SessionModal from './SessionModal';

type MobileCalendarViewProps = {
  sessions: Session[];
};

type Week = {
  start: Date;
  days: Date[];
};

export default function MobileCalendarView({ sessions }: MobileCalendarViewProps) {
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(0);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {weeks.map((week, idx) => {
        const label = `${format(week.start, 'MMM d')} – ${format(week.days[6], 'MMM d')}`;
        const isExpanded = expandedWeekIndex === idx;

        return (
          <div key={idx} className="border rounded-md bg-background overflow-hidden">
            <button
              onClick={() => setExpandedWeekIndex(isExpanded ? null : idx)}
              className="w-full px-4 py-3 bg-muted hover:bg-muted/80 transition-colors font-medium text-sm text-left"
            >
              {label}
            </button>

            {isExpanded && (
              <div className="p-3 space-y-5">
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
                        <div className="space-y-3">
                          {daySessions.map((s) => {
                            const rawTitle = s.title ?? '';
                            const isRest = rawTitle.toLowerCase().includes('rest day');
                            const displayTitle = isRest
                              ? '🛌 Rest Day'
                              : rawTitle.split(':')[0]?.trim() || 'Untitled';

                            const colorClass = getSessionColor(
                              isRest ? 'rest' : s.sport || ''
                            );

                            return (
                              <button
                                key={s.id}
                                className={`w-full text-left rounded-full px-3 py-1 text-sm font-medium truncate ${colorClass}`}
                                onClick={() => handleSessionClick(s)}
                              >
                                {displayTitle}
                              </button>
                            );
                          })}
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

      {/* Modal for Detailed Workout */}
      <SessionModal
        open={modalOpen}
        session={selectedSession}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
