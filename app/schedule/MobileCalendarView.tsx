// MobileCalendarView.tsx — Updated with tappable session cards
'use client';

import { useMemo, useState } from 'react';
import {
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfWeek,
  addDays,
} from 'date-fns';
import { useRouter } from 'next/navigation';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import SessionModal from './SessionModal';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

export type EnrichedSession = Session & { stravaActivity?: StravaActivity };

export type MobileCalendarViewProps = {
  sessions: EnrichedSession[];
};

type Week = {
  start: Date;
  days: Date[];
};

export default function MobileCalendarView({ sessions }: MobileCalendarViewProps) {
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(0);
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [sessionsState, setSessionsState] = useState<EnrichedSession[]>(sessions);
  const router = useRouter();

  const weeks: Week[] = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const result: Week[] = [];
    for (let i = 0; i < 12; i++) {
      const weekStart = addDays(start, i * 7);
      result.push({
        start: weekStart,
        days: Array.from({ length: 7 }, (_, d) => addDays(weekStart, d)),
      });
    }
    return result;
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, EnrichedSession[]> = {};
    sessionsState.forEach((s) => {
      const key = s.date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessionsState]);

  const handleUpdateSession = (updated: EnrichedSession) => {
    setSessionsState((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setSelectedSession(updated);
  };

  return (
    <div className="px-4 pb-20">
      {weeks.map((week, i) => {
        const weekLabel = `${format(week.days[0], 'MMM d')} – ${format(
          week.days[6],
          'MMM d'
        )}`;

        return (
          <div key={i} className="mb-8">
            <h2
              onClick={() => setExpandedWeekIndex(i === expandedWeekIndex ? null : i)}
              className="text-lg font-semibold mb-2 cursor-pointer"
            >
              {weekLabel}
            </h2>

            {expandedWeekIndex === i && (
              <div className="space-y-6">
                {week.days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const items = grouped[key] || [];

                  return (
                    <div key={key}>
                      <div className="text-sm font-medium text-muted mb-2">
                        {format(day, 'EEEE, MMM d')}
                      </div>
                      <div className="space-y-2">
                        {items.map((session) => {
                          const title = session.title || session.stravaActivity?.name || 'Strava Activity';
                          return (
                            <div
                              key={session.id}
                              onClick={() => setSelectedSession(session)}
                              className="rounded-xl p-3 bg-white shadow border cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <div className="text-sm font-medium">{title}</div>
                                <div className="text-xs text-muted">{format(parseISO(session.date), 'MMM d')}</div>
                              </div>
                              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        onUpdate={handleUpdateSession}
      />
    </div>
  );
}
