'use client';

import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  isValid,
  startOfWeek,
  differenceInCalendarWeeks,
} from 'date-fns';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import SessionModal from './SessionModal';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

type EnrichedSession = Session & { stravaActivity?: StravaActivity };

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

export type MobileCalendarViewProps = {
  sessions: EnrichedSession[];
  completedSessions: CompletedSession[];
};

function safeParseDate(input: string | Date): Date {
  if (typeof input === 'string') {
    const parsed = parseISO(input);
    return isValid(parsed) ? parsed : new Date();
  }
  return isValid(input) ? input : new Date();
}

export default function MobileCalendarView({
  sessions,
  completedSessions,
}: MobileCalendarViewProps) {
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [sessionsState, setSessionsState] = useState<EnrichedSession[]>(sessions);

  const sortedSessions = useMemo(() => {
    return [...sessionsState]
      .filter((s) => !!s.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessionsState]);

  const groupedByWeek = useMemo(() => {
    if (sortedSessions.length === 0) return {};

    const start = startOfWeek(safeParseDate(sortedSessions[0].date), { weekStartsOn: 1 });
    const weekMap: Record<string, EnrichedSession[]> = {};

    sortedSessions.forEach((session) => {
      const sessionDate = safeParseDate(session.date);
      const weekIndex = differenceInCalendarWeeks(sessionDate, start, { weekStartsOn: 1 });
      const weekLabel = `Week ${weekIndex + 1}`;

      if (!weekMap[weekLabel]) weekMap[weekLabel] = [];
      weekMap[weekLabel].push(session);
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
              const title = session.title || session.stravaActivity?.name || 'Unnamed Session';
              const date = safeParseDate(session.date);

              const isCompleted = completedSessions.some(
                (c) =>
                  c.session_date === session.date && c.session_title === session.title
              );

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`rounded-xl p-4 shadow border cursor-pointer flex items-center justify-between ${
                    isCompleted ? 'bg-green-50 border-green-300' : 'bg-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {title}
                      {isCompleted && <span className="ml-2 text-green-600">✓</span>}
                    </div>
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
