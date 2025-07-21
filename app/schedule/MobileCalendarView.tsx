// MobileCalendarView.tsx
'use client';

import { useMemo, useState } from 'react';
import { format, isSameDay, parseISO, startOfWeek, addDays } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@/types/session';
import { getSessionColor } from '@/utils/session-utils';
import SessionModal from './SessionModal'; // assumes modal lives alongside view

interface MobileCalendarViewProps {
  sessions: Session[];
}

interface Week {
  start: Date;
  days: Date[];
}

export default function MobileCalendarView({ sessions }: MobileCalendarViewProps) {
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(0);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [detailedMap, setDetailedMap] = useState<Record<string, string>>({});
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const supabase = createClientComponentClient();

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

  const handleGenerateWorkout = async (session: Session) => {
    if (!session) return;
    setLoadingSessionId(session.id);

    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        title: session.title,
        sport: session.sport,
        date: session.date,
      }),
    });

    const { details } = await res.json();
    await supabase.from('sessions').update({ structured_workout: details }).eq('id', session.id);

    setDetailedMap((prev) => ({ ...prev, [session.id]: details }));
    setLoadingSessionId(null);
  };

  return (
    <>
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
                                <div
                                  key={s.id}
                                  className={`rounded-full px-3 py-1 text-sm font-medium truncate ${colorClass}`}
                                  onClick={() => !isRest && setSelectedSession(s)}
                                >
                                  {displayTitle}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground px-1">
                            No sessions
                          </div>
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

      <SessionModal
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
      />
    </>
  );
}
