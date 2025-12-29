'use client';

import {
  format,
  parseISO,
  isValid,
  startOfWeek,
  differenceInCalendarWeeks,
  isWithinInterval,
  isBefore,
  endOfWeek,
} from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import SessionModal from './SessionModal';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

type EnrichedSession = Session & { stravaActivity?: StravaActivity };

type CompletedSession = {
  date: string;
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

function inferSport(title: string): 'run' | 'bike' | 'swim' | 'strength' | 'other' {
  const t = (title || '').toLowerCase();
  if (t.includes('swim')) return 'swim';
  if (t.includes('bike') || t.includes('ride') || t.includes('cycling')) return 'bike';
  if (t.includes('run')) return 'run';
  if (t.includes('strength') || t.includes('lift') || t.includes('gym')) return 'strength';
  return 'other';
}

function sportBadge(sport: ReturnType<typeof inferSport>) {
  switch (sport) {
    case 'swim':
      return { label: 'Swim', cls: 'bg-sky-50 text-sky-700 ring-sky-100' };
    case 'bike':
      return { label: 'Bike', cls: 'bg-amber-50 text-amber-700 ring-amber-100' };
    case 'run':
      return { label: 'Run', cls: 'bg-rose-50 text-rose-700 ring-rose-100' };
    case 'strength':
      return { label: 'Strength', cls: 'bg-violet-50 text-violet-700 ring-violet-100' };
    default:
      return { label: 'Session', cls: 'bg-zinc-50 text-zinc-700 ring-zinc-100' };
  }
}

// IMPORTANT: stable default to avoid re-render loops when prop is omitted
const EMPTY_STRAVA: StravaActivity[] = [];

export default function MobileCalendarView({
  sessions,
  completedSessions: initialCompleted,
  stravaActivities = EMPTY_STRAVA,
}: MobileCalendarViewProps) {
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [sessionsState, setSessionsState] = useState<EnrichedSession[]>(sessions);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>(initialCompleted);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});
  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Ensure the auto-scroll doesn't repeatedly fight the user
  const didAutoScroll = useRef(false);

  const today = new Date();

  // Keep internal state in sync if props change
  useEffect(() => setSessionsState(sessions), [sessions]);
  useEffect(() => setCompletedSessions(initialCompleted), [initialCompleted]);

  const sortedSessions = useMemo(() => {
    return [...sessionsState].filter((s) => !!s.date).sort((a, b) => a.date.localeCompare(b.date));
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

    const weekMap: Record<
      string,
      { sessions: EnrichedSession[]; extras: StravaActivity[]; start: Date; end: Date }
    > = {};

    allDateArray.forEach((dateStr) => {
      const date = safeParseDate(dateStr);
      const weekIndex = differenceInCalendarWeeks(date, start, { weekStartsOn: 1 });
      const weekLabel = `Week ${weekIndex + 1}`;

      if (!weekMap[weekLabel]) {
        const wkStart = startOfWeek(date, { weekStartsOn: 1 });
        weekMap[weekLabel] = {
          sessions: [],
          extras: [],
          start: wkStart,
          end: endOfWeek(date, { weekStartsOn: 1 }),
        };
      }

      sortedSessions
        .filter((s) => normalizeDate(safeParseDate(s.date)) === dateStr)
        .forEach((s) => weekMap[weekLabel].sessions.push(s));

      (extraStravaMap[dateStr] || []).forEach((a) => weekMap[weekLabel].extras.push(a));
    });

    return weekMap;
  }, [sortedSessions, extraStravaMap]);

  // Default-collapse past weeks (keeps "now" near the top)
  useEffect(() => {
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const initial: Record<string, boolean> = {};
    Object.entries(groupedByWeek).forEach(([label, { start }]) => {
      if (isBefore(start, currentWeekStart)) initial[label] = true; // collapsed
    });
    setCollapsedWeeks((prev) => ({ ...initial, ...prev }));
  }, [groupedByWeek, today]);

  // Scroll current week into view ONCE (avoids iOS phantom scrolling)
  useEffect(() => {
    if (didAutoScroll.current) return;

    const currentWeekEntry = Object.entries(groupedByWeek).find(([_, val]) => {
      return isWithinInterval(today, { start: val.start, end: val.end });
    });

    if (!currentWeekEntry) return;

    const weekLabel = currentWeekEntry[0];
    const el = weekRefs.current[weekLabel];
    if (!el) return;

    didAutoScroll.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [groupedByWeek, today]);

  if (sortedSessions.length === 0 && stravaActivities.length === 0) {
    return <div className="text-center text-zinc-400 pt-12">No sessions to display.</div>;
  }

  return (
    <div className="bg-[#fafafa] min-h-[100dvh]">
      {/* Sticky app-like top bar */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="pt-[env(safe-area-inset-top)]" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] text-zinc-500">Schedule</div>
            <div className="text-[20px] font-semibold tracking-tight text-zinc-900">This Plan</div>
          </div>

          <div className="h-9 w-9 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm">
            C
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-28 pt-4">
        {Object.entries(groupedByWeek).map(([weekLabel, { sessions, extras, start, end }]) => {
          const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
          const isPast = isBefore(start, currentWeekStart);
          const isCollapsed = collapsedWeeks[weekLabel];

          const rangeLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;

          return (
            <div
              key={weekLabel}
              ref={(el) => {
                weekRefs.current[weekLabel] = el;
              }}
              className="mb-6 scroll-mt-24"
            >
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-[13px] text-zinc-500">{rangeLabel}</div>
                  <h2 className="text-[16px] font-semibold text-zinc-900">{weekLabel}</h2>
                </div>

                {isPast && (
                  <button
                    onClick={() =>
                      setCollapsedWeeks((prev) => ({
                        ...prev,
                        [weekLabel]: !prev[weekLabel],
                      }))
                    }
                    className="text-[13px] text-zinc-500 underline underline-offset-2"
                  >
                    {isCollapsed ? 'Show' : 'Hide'}
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {sessions.map((session) => {
                      const title = session.title || session.stravaActivity?.name || 'Unnamed Session';
                      const date = safeParseDate(session.date);
                      const isCompleted = completedSessions.some(
                        (c) => c.date === session.date && c.session_title === session.title
                      );

                      const sport = inferSport(title);
                      const badge = sportBadge(sport);

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 active:bg-zinc-100 transition"
                        >
                          <span
                            className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${badge.cls}`}
                          >
                            {badge.label}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[14px] font-medium text-zinc-900 truncate">{title}</div>
                              {isCompleted && (
                                <span className="shrink-0 text-[12px] text-emerald-600 font-medium">✓</span>
                              )}
                            </div>

                            <div className="text-[12px] text-zinc-500 truncate">
                              {format(date, 'EEE, MMM d')}
                            </div>
                          </div>

                          <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                        </button>
                      );
                    })}

                    {extras.map((a) => {
                      const date = safeParseDate(a.start_date_local);
                      const distance = a.distance ? `${(a.distance / 1609).toFixed(1)} mi` : '';
                      const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';

                      return (
                        <div key={a.id} className="px-4 py-3 bg-blue-50/60">
                          <div className="text-[13px] font-medium text-blue-900 truncate">
                            Strava • {a.name || 'Unplanned Activity'}
                          </div>
                          <div className="text-[12px] text-blue-800 truncate">
                            {format(date, 'EEE, MMM d')}
                            {distance ? ` • ${distance}` : ''}
                            {hr ? ` • ${hr}` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
          completedSessions={completedSessions}
          onCompletedUpdate={(updatedList) => setCompletedSessions(updatedList)}
        />
      </div>
    </div>
  );
}
