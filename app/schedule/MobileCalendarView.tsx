'use client';

import { useMemo, useState } from 'react';
import { format, isAfter, isSameDay, parseISO, startOfWeek, addDays } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@/types/session';

type MobileCalendarViewProps = {
  sessions: Session[];
};

type Week = {
  start: Date;
  days: Date[];
};

const getSessionColor = (sport: string) => {
  switch (sport.toLowerCase()) {
    case 'swim':
      return 'bg-blue-100 text-blue-800';
    case 'bike':
      return 'bg-yellow-100 text-yellow-800';
    case 'run':
      return 'bg-green-100 text-green-800';
    case 'strength':
      return 'bg-purple-100 text-purple-800';
    case 'rest':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-primary/10 text-primary';
  }
};

export default function MobileCalendarView({ sessions }: MobileCalendarViewProps) {
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(0);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [detailedMap, setDetailedMap] = useState<Record<string, string>>({});

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

    const res = await fetch('/api/generate-detailed-workout', {
      method: 'POST',
      body: JSON.stringify({
        title: session.title,
        date: session.date,
        sport: session.sport,
      }),
    });

    const { output } = await res.json();

    await supabase.from('sessions').update({ details: output }).eq('id', session.id);
    setDetailedMap((prev) => ({ ...prev, [session.id]: output }));
    setLoadingSessionId(null);
  };

  return (
    <div className="space-y-4">
      {weeks.map((week, idx) => {
        const label = `${format(week.start, 'MMM d')} – ${format(week.days[6], 'MMM d')}`;
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
                        <div className="space-y-3">
                          {daySessions.map((s) => {
                            const output = detailedMap[s.id] || s.details;
                            return (
                              <div
                                key={s.id}
                                className={`rounded p-2 ${getSessionColor(s.sport)} space-y-2`}
                              >
                                <div className="text-sm font-medium">{s.title}</div>

                                {output ? (
                                  <div className="text-sm whitespace-pre-wrap bg-white border rounded p-2">
                                    {output}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleGenerateWorkout(s)}
                                    disabled={loadingSessionId === s.id}
                                    className="text-sm bg-black text-white rounded px-3 py-1 disabled:opacity-50"
                                  >
                                    {loadingSessionId === s.id
                                      ? 'Generating...'
                                      : 'Generate Detailed Workout'}
                                  </button>
                                )}
                              </div>
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
    </div>
  );
}
