'use client';

import React from 'react';
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
import SessionModal from './SessionModal';
import AddSessionModalTP from './AddSessionModalTP';
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
  onSessionDeleted?: (sessionId: string) => void;
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

function deriveDetail(title: string) {
  const t = title || '';
  const match = t.match(/\(([^)]+)\)/);
  if (match?.[1]) return match[1].trim();

  const lower = t.toLowerCase();
  if (lower.includes('threshold')) return 'Threshold';
  if (lower.includes('tempo')) return 'Tempo';
  if (lower.includes('endurance')) return 'Endurance';
  if (lower.includes('easy')) return 'Easy';
  if (lower.includes('long')) return 'Long';
  if (lower.includes('drill')) return 'Drills';
  if (lower.includes('brick')) return 'Brick';
  return '';
}

function isKeySession(title: string) {
  const t = (title || '').toLowerCase();
  return (
    t.includes('long ride') ||
    t.includes('long run') ||
    t.includes('threshold') ||
    t.includes('tempo') ||
    t.includes('brick')
  );
}

const EMPTY_STRAVA: StravaActivity[] = [];

/**
 * Premium monochrome sport icons (inline SVGs).
 * - All icons use currentColor.
 * - Subtle + consistent to avoid pastel identity noise.
 */
function SportIcon({
  sport,
  className,
}: {
  sport: ReturnType<typeof inferSport>;
  className?: string;
}) {
  switch (sport) {
    case 'bike':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M5.5 18.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm13 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8.3 15.2 10.8 8h3.2l2.4 7.2M10.2 8 8 8m8 0h-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'run':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M14.3 6.2a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 0 0 3.6 0Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M11.3 21.2l2.2-4.3m-1.1-5.8 2.2 2.2 3.4.7M8.6 20.7l1.9-4.1-1.6-3.1 2.2-4.1 3.1 1.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'swim':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M8 9.2c1.7-1.6 3.6-2.2 5.8-1.8l2.2.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M3.5 16.6c1.7 0 1.7-1.2 3.4-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.4-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.4-1.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M13.9 6.2a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 0 0 2.8 0Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case 'strength':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M7 10v4m10-4v4M9 9h6M9 15h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M5.5 9.8V14.2M18.5 9.8V14.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
  }
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props} aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function sportLabelFromType(sport: ReturnType<typeof inferSport>) {
  if (sport === 'bike') return 'Bike';
  if (sport === 'run') return 'Run';
  if (sport === 'swim') return 'Swim';
  if (sport === 'strength') return 'Strength';
  return 'Session';
}

function sportToneClasses(sport: ReturnType<typeof inferSport>) {
  if (sport === 'bike') return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  if (sport === 'run') return 'bg-zinc-900 text-zinc-100 border-zinc-800';
  if (sport === 'swim') return 'bg-zinc-200 text-zinc-700 border-zinc-300';
  if (sport === 'strength') return 'bg-zinc-800 text-zinc-100 border-zinc-700';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export default function MobileCalendarView({
  sessions,
  completedSessions: initialCompleted,
  stravaActivities = EMPTY_STRAVA,
  onSessionDeleted,
}: MobileCalendarViewProps) {
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);
  const [sessionsState, setSessionsState] = useState<EnrichedSession[]>(sessions);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>(initialCompleted);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});
  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const didAutoScroll = useRef(false);

  const today = new Date();

  const getDefaultAddDate = () => {
    const currentWeekEntry = Object.values(groupedByWeek).find((val) =>
      isWithinInterval(today, { start: val.start, end: val.end })
    );
    if (!currentWeekEntry) return today;

    const firstSession = [...currentWeekEntry.sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(0);

    return firstSession ? safeParseDate(firstSession.date) : today;
  };

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

  useEffect(() => {
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const initial: Record<string, boolean> = {};
    Object.entries(groupedByWeek).forEach(([label, { start }]) => {
      if (isBefore(start, currentWeekStart)) initial[label] = true;
    });
    setCollapsedWeeks((prev) => ({ ...initial, ...prev }));
  }, [groupedByWeek, today]);

  useEffect(() => {
    if (didAutoScroll.current) return;

    const currentWeekEntry = Object.entries(groupedByWeek).find(([_, val]) =>
      isWithinInterval(today, { start: val.start, end: val.end })
    );

    if (!currentWeekEntry) return;

    const weekLabel = currentWeekEntry[0];
    const el = weekRefs.current[weekLabel];
    if (!el) return;

    didAutoScroll.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [groupedByWeek, today]);

  if (sortedSessions.length === 0 && stravaActivities.length === 0) {
    return <div className="text-center text-zinc-500 pt-12">No sessions to display.</div>;
  }

  return (
    <div className="bg-zinc-100 min-h-[100dvh] text-zinc-950">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-zinc-100/95 backdrop-blur border-b border-black/5">
        <div className="pt-[env(safe-area-inset-top)]" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[12px] tracking-wide text-zinc-500 uppercase">Schedule</div>
            <div className="text-[20px] font-semibold tracking-tight text-zinc-950">Weekly Flow</div>
          </div>

          <button
            type="button"
            onClick={() => setAddSessionDate(getDefaultAddDate())}
            className="h-9 rounded-md border border-black/10 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-sm"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="px-4 pb-28 pt-4 space-y-6">
        {Object.entries(groupedByWeek).map(([weekLabel, { sessions, extras, start, end }]) => {
          const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
          const isPast = isBefore(start, currentWeekStart);
          const isCollapsed = collapsedWeeks[weekLabel];
          const rangeLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
          const completedCount = sessions.filter((session) =>
            completedSessions.some(
              (c) => c.date === session.date && c.session_title === session.title
            )
          ).length;
          const keySessionCount = sessions.filter((session) => isKeySession(session.title || '')).length;
          const completionRate = sessions.length
            ? Math.round((completedCount / sessions.length) * 100)
            : 0;

          return (
            <div
              key={weekLabel}
              ref={(el) => {
                weekRefs.current[weekLabel] = el;
              }}
              className="scroll-mt-24"
            >
              <div className="rounded-2xl border border-black/5 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.06)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] uppercase tracking-wide text-zinc-500">{rangeLabel}</div>
                    <h2 className="text-[20px] font-semibold tracking-tight text-zinc-950 mt-1">
                      {weekLabel}
                    </h2>
                  </div>

                  {isPast && (
                    <button
                      onClick={() =>
                        setCollapsedWeeks((prev) => ({ ...prev, [weekLabel]: !prev[weekLabel] }))
                      }
                      className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-medium text-zinc-700"
                    >
                      {isCollapsed ? 'Expand' : 'Collapse'}
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-black/5 bg-zinc-50 px-3 py-2">
                    <div className="text-[11px] text-zinc-500">Sessions</div>
                    <div className="text-[16px] font-semibold text-zinc-900">{sessions.length}</div>
                  </div>
                  <div className="rounded-xl border border-black/5 bg-zinc-50 px-3 py-2">
                    <div className="text-[11px] text-zinc-500">Done</div>
                    <div className="text-[16px] font-semibold text-zinc-900">{completedCount}</div>
                  </div>
                  <div className="rounded-xl border border-black/5 bg-zinc-50 px-3 py-2">
                    <div className="text-[11px] text-zinc-500">Key work</div>
                    <div className="text-[16px] font-semibold text-zinc-900">{keySessionCount}</div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-2xl overflow-hidden border border-black/5 bg-white shadow-[0_14px_35px_rgba(0,0,0,0.08)]">
                    {sessions.map((session) => {
                      const title = session.title || session.stravaActivity?.name || 'Unnamed Session';
                      const date = safeParseDate(session.date);

                      const completed = completedSessions.some(
                        (c) => c.date === session.date && c.session_title === session.title
                      );

                      const sport = inferSport(title);
                      const detail = deriveDetail(title);
                      const key = isKeySession(title);

                      const sportLabel = sportLabelFromType(sport);

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={[
                            'relative w-full text-left px-4 py-4 flex items-center gap-3 transition border-b border-black/5 last:border-b-0',
                            'active:bg-black/[0.03] hover:bg-zinc-50',
                            completed ? 'opacity-70' : 'opacity-100',
                          ].join(' ')}
                        >
                          {/* Key-session accent bar */}
                          {key && (
                            <span
                              className="absolute left-0 top-0 bottom-0 w-[2px] bg-zinc-500"
                              aria-hidden="true"
                            />
                          )}

                          <div
                            className={[
                              'shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center',
                              sportToneClasses(sport),
                            ].join(' ')}
                          >
                            <SportIcon sport={sport} className="h-5 w-5" />
                          </div>


                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[15px] font-semibold text-zinc-950 truncate">
                                {title}
                              </div>

                              {completed && (
                                <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                                  Done
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-[13px] text-zinc-600 truncate">
                              <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                                {sportLabel}
                              </span>
                              <span className="text-zinc-400">{'  •  '}</span>
                              <span>{format(date, 'EEE, MMM d')}</span>
                              {detail ? (
                                <>
                                  <span className="text-zinc-400">{'  •  '}</span>
                                  <span className="text-zinc-800">{detail}</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <ChevronIcon className="w-4 h-4 shrink-0 text-black/25" />
                        </button>
                      );
                    })}

                    {Array.from(new Set(sessions.map((s) => normalizeDate(safeParseDate(s.date))).filter(Boolean)))
                      .sort()
                      .map((dateKey) => (
                        <div key={`add-${dateKey}`} className="px-4 py-2.5 border-b border-black/5 last:border-b-0">
                          <button
                            type="button"
                            onClick={() => setAddSessionDate(safeParseDate(dateKey))}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-dashed border-black/20 bg-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
                          >
                            + Add session for {format(safeParseDate(dateKey), 'EEE, MMM d')}
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Strava-only extras */}
                  {extras.map((a) => {
                      const date = safeParseDate(a.start_date_local);
                      const distance = a.distance ? `${(a.distance / 1609).toFixed(1)} mi` : '';
                      const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';

                      return (
                        <div
                          key={a.id}
                          className="px-4 py-4 flex items-center gap-3 rounded-2xl border border-black/5 bg-zinc-50"
                        >
                          <div className="shrink-0 h-10 w-10 rounded-xl bg-white border border-black/5 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-zinc-800">
                              <path
                                d="M12 4v12m0 0 4-4m-4 4-4-4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M5 20h14"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[14px] font-semibold text-zinc-950 truncate">
                                {a.name || 'Unplanned Activity'}
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-black/5 text-zinc-600">
                                Imported
                              </span>
                            </div>
                            <div className="mt-0.5 text-[13px] text-zinc-600 truncate">
                              {format(date, 'EEE, MMM d')}
                              {distance ? <span className="text-zinc-400">{`  •  `}</span> : null}
                              {distance ? <span className="text-zinc-800">{distance}</span> : null}
                              {hr ? <span className="text-zinc-400">{`  •  `}</span> : null}
                              {hr ? <span className="text-zinc-800">{hr}</span> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setAddSessionDate(getDefaultAddDate())}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 z-30 inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-zinc-950 px-5 text-[14px] font-semibold text-white shadow-[0_14px_30px_rgba(0,0,0,0.25)] active:translate-y-[0.5px] md:hidden"
          aria-label="Add session"
        >
          + Add session
        </button>

        <SessionModal
          session={selectedSession}
          stravaActivity={selectedSession?.stravaActivity}
          open={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          completedSessions={completedSessions}
          onCompletedUpdate={(updatedList) => setCompletedSessions(updatedList)}
          onSessionDeleted={(sessionId) => {
            setSessionsState((prev) => prev.filter((s) => s.id !== sessionId));
            setCompletedSessions((prev) =>
              prev.filter(
                (c) =>
                  !(
                    c.date === selectedSession?.date &&
                    c.session_title === selectedSession?.title
                  )
              )
            );
            onSessionDeleted?.(sessionId);
            setSelectedSession(null);
          }}
        />

        <AddSessionModalTP
          open={!!addSessionDate}
          date={addSessionDate ?? today}
          onClose={() => setAddSessionDate(null)}
          onAdded={(newSession: EnrichedSession) => {
            setSessionsState((prev) => [...prev, newSession]);
            setAddSessionDate(null);
          }}
        />
      </div>
    </div>
  );
}
