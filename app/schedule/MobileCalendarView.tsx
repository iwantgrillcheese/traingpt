'use client';

import React from 'react';
import {
  format,
  parseISO,
  isValid,
  startOfWeek,
  differenceInCalendarWeeks,
  isWithinInterval,
  endOfWeek,
} from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import SessionModal from './SessionModal';
import AddSessionModalTP from './AddSessionModalTP';
import type { Session } from '@/types/session';
import { conciseSessionLabel } from './session-utils';
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


function cleanSessionTitle(title: string) {
  return (title || '')
    .replace(/\s+[—–-]\s+/g, ' ')
    .replace(/[—–]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

function SportIcon({ sport }: { sport: ReturnType<typeof inferSport>; className?: string }) {
  const label = sport === 'bike' ? 'B' : sport === 'run' ? 'R' : sport === 'swim' ? 'S' : sport === 'strength' ? 'ST' : '•';
  return <span className="text-[12px] font-bold tracking-[0.02em]">{label}</span>;
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

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  bike: { color: '#0D9488', bg: '#F0FAFA' },
  swim: { color: '#2563EB', bg: '#EFF6FF' },
  run: { color: '#EA580C', bg: '#FFF7ED' },
  strength: { color: '#6B7280', bg: '#F3F4F6' },
  other: { color: '#6B7280', bg: '#F3F4F6' },
};

function sessionDurationLabel(session: EnrichedSession) {
  const fromField = (session as any)?.duration;
  if (typeof fromField === 'number' && Number.isFinite(fromField)) {
    if (fromField >= 60) {
      const h = Math.floor(fromField / 60);
      const m = Math.round(fromField % 60);
      return m ? `${h}hr ${m}min` : `${h}hr`;
    }
    return `${Math.round(fromField)}min`;
  }

  const t = `${session.title || ''} ${session.details || ''}`;
  const hrMatch = t.match(/(\d+(?:\.\d+)?)\s*(hr|hour|hours)/i);
  if (hrMatch) {
    const h = Number(hrMatch[1]);
    if (Number.isFinite(h)) return h % 1 === 0 ? `${h}hr` : `${h}hr`;
  }
  const minMatch = t.match(/(\d{1,3})\s*min/i);
  if (minMatch) return `${minMatch[1]}min`;
  return '45min';
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

  const orderedWeeks = useMemo(() => {
    const todayMs = startOfWeek(today, { weekStartsOn: 1 }).getTime();
    return Object.entries(groupedByWeek).sort(([, a], [, b]) => {
      const aMs = a.start.getTime();
      const bMs = b.start.getTime();

      const bucket = (ms: number) => {
        if (ms === todayMs) return 0;
        if (ms > todayMs) return 1;
        return 2;
      };

      const ab = bucket(aMs);
      const bb = bucket(bMs);
      if (ab !== bb) return ab - bb;

      if (ab === 2) return bMs - aMs;
      return aMs - bMs;
    });
  }, [groupedByWeek, today]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    Object.entries(groupedByWeek).forEach(([label, { start, end }]) => {
      const isCurrentWeek = isWithinInterval(today, { start, end });
      initial[label] = !isCurrentWeek;
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
    <div className="min-h-[100dvh] text-zinc-950" style={{ background: '#F4F2ED' }}>
      <div className="sticky top-0 z-20 border-b" style={{ background: '#F4F2ED', borderColor: '#F0EEE9' }}>
        <div className="pt-[env(safe-area-inset-top)]" />
        <div className="px-5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B0ADA5' }}>Schedule</div>
        </div>
      </div>

      <div className="px-4 pb-28 pt-4 space-y-5">
        {orderedWeeks.map(([weekLabel, { sessions, extras, start, end }]) => {
          const isCollapsed = collapsedWeeks[weekLabel];
          const isCurrentWeek = isWithinInterval(today, { start, end });
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
              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="px-[18px] pt-[18px] pb-[14px] flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#B0ADA5' }}>{rangeLabel}</div>
                    <h2 className="mt-1 text-[22px] font-bold tracking-[-0.015em]" style={{ color: '#18170F' }}>{weekLabel}</h2>
                  </div>
                  <button
                    onClick={() => setCollapsedWeeks((prev) => ({ ...prev, [weekLabel]: !prev[weekLabel] }))}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-medium"
                    style={{ borderColor: '#F0EEE9', color: '#8A8880' }}
                  >
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>

                <div className="grid grid-cols-3 px-[18px] pb-4">
                  {[
                    ['Sessions', String(sessions.length), '#18170F'],
                    ['Done', String(completedCount), completedCount > 0 ? '#0D9488' : '#C0BDB5'],
                    ['Key work', String(keySessionCount), '#18170F'],
                  ].map(([label, value, color], idx) => (
                    <div
                      key={label}
                      className="py-0"
                      style={{
                        borderRight: idx < 2 ? '1px solid #F0EEE9' : 'none',
                        paddingRight: idx < 2 ? 16 : 0,
                        paddingLeft: idx > 0 ? 16 : 0,
                      }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#B0ADA5' }}>{label}</div>
                      <div className="mt-1 text-[28px] font-bold leading-none" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="px-[18px] pb-[18px]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#B0ADA5' }}>Progress</span>
                    <span className="text-[10px] font-bold" style={{ color: '#B0ADA5' }}>{completionRate}%</span>
                  </div>
                  <div className="h-[4px] w-full overflow-hidden rounded-full" style={{ background: '#F0EEE9' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${completionRate}%`, background: '#18170F' }} />
                  </div>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    {sessions.map((session, idx) => {
                      const rawTitle = session.title || session.stravaActivity?.name || 'Unnamed Session';
                      const title = conciseSessionLabel(cleanSessionTitle(rawTitle), session.sport);
                      const date = safeParseDate(session.date);

                      const completed = completedSessions.some(
                        (c) => c.date === session.date && c.session_title === session.title
                      );

                      const sport = inferSport(rawTitle);
                      const detail = deriveDetail(rawTitle);
                      const key = isKeySession(rawTitle);
                      const type = TYPE_STYLES[sport] || TYPE_STYLES.other;
                      const duration = sessionDurationLabel(session);
                      const meta = `${format(date, 'EEE, MMM d')} · ${session.details || detail || sportLabelFromType(sport)}`;

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className="w-full text-left flex items-center gap-[14px] px-4 py-[14px] transition"
                          style={{
                            borderBottom: idx === sessions.length - 1 ? 'none' : '1px solid #F0EEE9',
                            background: '#fff',
                            opacity: completed ? 0.4 : 1,
                          }}
                        >
                          <div
                            className="relative shrink-0 h-[44px] w-[44px] rounded-[12px] flex items-center justify-center"
                            style={{ background: completed ? '#F0EEE9' : type.bg, color: completed ? '#C0BDB5' : type.color }}
                          >
                            {key ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: -2,
                                  right: -2,
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: type.color,
                                  border: '1.5px solid #fff',
                                }}
                              />
                            ) : null}
                            <SportIcon sport={sport} className="h-[22px] w-[22px]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-semibold leading-[1.3]" style={{ color: '#18170F' }}>
                              {title}
                            </div>
                            <div className="mt-[2px] text-[13px] font-medium" style={{ color: type.color }}>
                              {detail || sportLabelFromType(sport)}
                            </div>
                            <div className="mt-[2px] text-[12px] font-normal" style={{ color: '#A8A49C' }}>
                              {meta}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {completed ? (
                              <div className="h-[22px] w-[22px] rounded-full flex items-center justify-center" style={{ background: '#E8F5E9' }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M2 6l3 3 5-5" stroke="#4CAF50" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            ) : (
                              <ChevronIcon className="h-4 w-4" style={{ color: '#D4D1CA' }} />
                            )}
                            <span className="text-[11px] font-medium" style={{ color: '#C0BDB5' }}>{duration}</span>
                          </div>
                        </button>
                      );
                    })}


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
                            <div className="text-[14px] font-semibold text-zinc-950">
                              {a.name || 'Unplanned Activity'}
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-black/5 text-zinc-600">
                              Imported
                            </span>
                          </div>
                          <div className="mt-0.5 text-[13px] text-zinc-600">
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

                  {isCurrentWeek && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setAddSessionDate(getDefaultAddDate())}
                        className="w-full inline-flex h-11 items-center justify-center rounded-xl text-[14px] font-semibold text-white"
                        style={{ background: '#18170F' }}
                        aria-label="Add session"
                      >
                        + Add session
                      </button>
                    </div>
                  )}
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
          onSessionUpdated={(updatedSession) => {
            setSessionsState((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? { ...s, details: updatedSession.details } : s))
            );
            setSelectedSession((prev) =>
              prev?.id === updatedSession.id ? { ...prev, details: updatedSession.details } : prev
            );
          }}
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
