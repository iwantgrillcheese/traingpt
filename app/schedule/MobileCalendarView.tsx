'use client';

import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  differenceInCalendarWeeks,
} from 'date-fns';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import SessionModal from './SessionModal';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

export type EnrichedSession = Session & { stravaActivity?: StravaActivity };

export type MobileCalendarViewProps = {
  sessions: EnrichedSession[];
};

function safeParseDate(input: string | Date): Date {
  try {
    return typeof input === 'string' ? parseISO(input) : input;
  } catch {
    return new Date();
  }
}

export default function MobileCalendarView({ sessions }: MobileCalendarViewProps) {
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [sessionsState, setSessionsState] = useState<EnrichedSession[]>(sessions);

  console.log('[📱 MobileCalendarView] sessions loaded:', sessionsState.slice(0, 5));

  const sortedSessions = useMemo(() => {
    return [...sessionsState]
      .filter((s) => !!s.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessionsState]);

  const groupedByWeek = useMemo(() => {
    const start = sortedSessions.length > 0 ? safeParseDate(sortedSessions[0].date) : new Date();
    const weekMap: Record<string, EnrichedSession[]> = {};

    sortedSessions.forEach((s) => {
      const weekIndex = differenceInCalendarWeeks(safeParseDate(s.date), start, {
        weekStartsOn: 1,
      });
      const label = `Week ${weekIndex + 1}`;
      if (!weekMap[label]) weekMap[label] = [];
      weekMap[label].push(s);
    });

    return weekMap;
  }, [sortedSessions]);

  const handleUpdateSession = (updated: EnrichedSession) => {
    setSessionsState((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setSelectedSession(updated);
  };

  if (sortedSessions.length === 0) {
    return (
      <div className="text-center text-zinc-400 pt-12">
        No sessions to display.
      </div>
    );
  }

  return (
    <div className="px-4 pb-24">
      {Object.entries(groupedByWeek).map(([weekLabel, weekSessions]) => (
        <div key={weekLabel} className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{weekLabel}</h2>

          <div className="space-y-4">
            {weekSessions.map((session) => {
              const title =
                session.title || session.stravaActivity?.name || 'Unnamed Session';
              const date = safeParseDate(session.date);

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="rounded-xl p-4 bg-white shadow border cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">{title}</div>
                    <div className="text-xs text-zinc-500">
                      {format(date, 'EEEE, MMM d')}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </div>
              );
            })}
          </div>
        </div>
      ))}

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
