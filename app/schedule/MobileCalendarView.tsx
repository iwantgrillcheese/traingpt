'use client';

import {
  format,
  parseISO,
  isValid,
  startOfWeek,
  differenceInCalendarWeeks,
  isWithinInterval,
  isBefore,
} from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  stravaActivities?: StravaActivity[];
};

function safeParseDate(input: string | Date): Date {
  if (typeof input === 'string') {
    const parsed = parseISO(input);
    return isValid(parsed) ? parsed : new Date();
  }
  return isValid(input) ? input : new Date();
}

function normalizeDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function MobileCalendarView({
  sessions,
  completedSessions: initialCompleted,
  stravaActivities = [],
}: MobileCalendarViewProps) {
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [sessionsState, setSessionsState] = useState<EnrichedSession[]>(sessions);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>(initialCompleted);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});

  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const today = new Date();

  const sortedSessions = useMemo(() => {
    return [...sessionsState]
      .filter((s) => !!s.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessionsState]);

  const sessionDates = useMemo(
    () => new Set(sortedSessions.map((s) => normalizeDate(safeParseDate(s.date)))),
    [sortedSessions]
  );

  const extraStravaMap = useMemo(() => {
    const map: Record<string, StravaActivity[]> = {};
    stravaActivities.forEach((a) => {
      const dateStr = a.start_date_local?.split('T')[0];
      if (!dateStr || sessionDates.has(dateStr)) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(a);
    });
    return map;
  }, [stravaActivities, sessionDates]);

  const groupedByWeek = useMemo(() => {
    const allDates = new Set<string>();
    sortedSessions.forEach((s) => allDates.add(normalizeDate(safeParseDate(s.date))));
    Object.keys(extraStravaMap).forEach((d) => allDates.add(d));

    const allDateArray = [...allDates].sort();

    if (allDateArray.length === 0) return {};

    const start = startOfWeek(safeParseDate(allDateArray[0]), { weekStartsOn: 1 });
    const weekMap: Record<string, { sessions: EnrichedSession[]; extras: StravaActivity[]; start: Date }> = {};

    allDateArray.forEach((dateStr) => {
      const date = safeParseDate(dateStr);
      const weekIndex = differenceInCalendarWeeks(date, start, { weekStartsOn: 1 });
      const weekLabel = `Week ${weekIndex + 1}`;
      if (!weekMap[weekLabel]) {
        weekMap[weekLabel] = { sessions: [], extras: [], start: startOfWeek(date, { weekStartsOn: 1 }) };
      }

      sortedSessions
        .filter((s) => normalizeDate(safeParseDate(s.date)) === dateStr)
        .forEach((s) => weekMap[weekLabel].sessions.push(s));

      (extraStravaMap[dateStr] || []).forEach((a) => weekMap[weekLabel].extras.push(a));
    });

    return weekMap;
  }, [sortedSessions, extraStravaMap]);

  useEffect(() => {
    const currentWeekEntry = Object.entries(groupedByWeek).find(([_, val]) =>
      [...val.sessions, ...val.extras].some((s: any) => {
        const date = safeParseDate(s.date || s.start_date_local);
        return isWithinInterval(today, {
          start: startOfWeek(date, { weekStartsOn: 1 }),
          end: new Date(startOfWeek(date, { weekStartsOn: 1 }).getTime() + 6 * 86400000),
        });
      })
    );

    if (currentWeekEntry) {
      const weekLabel = currentWeekEntry[0];
      const el = weekRefs.current[weekLabel];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [groupedByWeek]);

  const handleUpdateSession = (updated: EnrichedSession, action: 'mark' | 'undo') => {
    setSessionsState((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setSelectedSession(updated);

    setCompletedSessions((prev) => {
      const exists = prev.some(
        (c) => c.session_date === updated.date && c.session_title === updated.title
      );

      if (action === 'mark' && !exists) {
        return [...prev, { session_date: updated.date, session_title: updated.title }];
      }

      if (action === 'undo' && exists) {
        return prev.filter(
          (c) => !(c.session_date === updated.date && c.session_title === updated.title)
        );
      }

      return prev;
    });
  };

  if (sortedSessions.length === 0 && stravaActivities.length === 0) {
    return <div className="text-center text-zinc-400 pt-12">No sessions to display.</div>;
  }

  return (
    <div className="px-4 pb-32">
      <div className="sticky top-0 z-10 bg-white pt-4 pb-2">
        <div className="flex justify-center">
          <button
            onClick={async () => {
              const res = await fetch('/api/stripe/checkout', { method: 'POST' });
              const { url } = await res.json();
              if (url) window.location.href = url;
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-black transition"
          >
            🙌 Has TrainGPT been helpful? Support the project ($5/month)
          </button>
        </div>
      </div>

      {Object.entries(groupedByWeek).map(([weekLabel, { sessions, extras, start }]) => {
        const isPast = isBefore(start, startOfWeek(today, { weekStartsOn: 1 }));
        const isCollapsed = collapsedWeeks[weekLabel];

        return (
          <div
            key={weekLabel}
            ref={(el) => {
              weekRefs.current[weekLabel] = el;
            }}
            className="mb-8"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-zinc-600">{weekLabel}</h2>
              {isPast && (
                <button
                  onClick={() =>
                    setCollapsedWeeks((prev) => ({
                      ...prev,
                      [weekLabel]: !prev[weekLabel],
                    }))
                  }
                  className="text-sm text-zinc-400 underline"
                >
                  {isCollapsed ? 'Show Previous Week' : 'Hide Previous Week'}
                </button>
              )}
            </div>

            {!isCollapsed && (
              <div className="space-y-3">
                {sessions.map((session) => {
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
                      className={`rounded-xl p-4 border flex items-center justify-between cursor-pointer transition shadow-sm ${
                        isCompleted
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-zinc-900">
                          {title}
                          {isCompleted && <span className="ml-2 text-green-600">✓</span>}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {format(date, 'EEEE, MMM d')}
                        </div>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
                    </div>
                  );
                })}

                {extras.map((a) => {
                  const date = safeParseDate(a.start_date_local);
                  const distance = a.distance ? `${(a.distance / 1609).toFixed(1)} mi` : '';
                  const pace =
                    a.moving_time && a.distance
                      ? `${Math.round((a.moving_time / (a.distance / 1000)) / 60)} min/km`
                      : '';
                  const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';

                  return (
                    <div
                      key={a.id}
                      className="rounded-xl p-4 border flex flex-col bg-blue-50 border-blue-300"
                    >
                      <div className="text-sm font-medium text-blue-800 mb-1">
                        🚴 {a.name || 'Unplanned Activity'}
                      </div>
                      <div className="text-xs text-blue-700">
                        {format(date, 'EEEE, MMM d')} • {distance} {hr && `• ${hr}`} {pace && `• ${pace}`}
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
