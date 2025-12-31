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

function sportGlyph(sport: ReturnType<typeof inferSport>) {
  // Keep monochrome + minimal. No “cute” identity.
  switch (sport) {
    case 'swim':
      return 'Sw';
    case 'bike':
      return 'Bk';
    case 'run':
      return 'Rn';
    case 'strength':
      return 'St';
    default:
      return '•';
  }
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

const EMPTY_STRAVA: StravaActivity[] = [];

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
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
  const didAutoScroll = useRef(false);

  const today = new Date();

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
    <div className="bg-[#f6f6f4] min-h-[100dvh]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-[#f6f6f4]/90 backdrop-blur border-b border-black/5">
        <div className="pt-[env(safe-area-inset-top)]" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[12px] tracking-wide text-zinc-500 uppercase">Schedule</div>
            <div className="text-[20px] font-semibold tracking-tight text-zinc-950">
              This Plan
            </div>
          </div>

          <div className="h-9 w-9 rounded-full bg-zinc-950 text-white flex items-center justify-center text-sm font-semibold">
            C
          </div>
        </div>
      </div>

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
                  <div className="text-[13px] text-zinc-600">{rangeLabel}</div>
                  <h2 className="text-[18px] font-semibold text-zinc-950">{weekLabel}</h2>
                </div>

                {isPast && (
                  <button
                    onClick={() =>
                      setCollapsedWeeks((prev) => ({ ...prev, [weekLabel]: !prev[weekLabel] }))
                    }
                    className="text-[13px] text-zinc-600 underline underline-offset-2"
                  >
                    {isCollapsed ? 'Show' : 'Hide'}
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className="rounded-2xl border border-black/5 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="divide-y divide-black/5">
                    {sessions.map((session) => {
                      const title = session.title || session.stravaActivity?.name || 'Unnamed Session';
                      const date = safeParseDate(session.date);

                      const isCompleted = completedSessions.some(
                        (c) => c.date === session.date && c.session_title === session.title
                      );

                      const sport = inferSport(title);
                      const glyph = sportGlyph(sport);
                      const detail = deriveDetail(title);

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className="w-full text-left px-4 py-4 flex items-center gap-3 active:bg-black/[0.03] transition"
                        >
                          {/* Minimal sport marker */}
                          <div className="shrink-0 h-9 w-9 rounded-full bg-black/[0.04] flex items-center justify-center">
                            <span className="text-[12px] font-semibold text-zinc-700">{glyph}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[15px] font-semibold text-zinc-950 truncate">
                                {title}
                              </div>

                              {isCompleted && (
                                <span className="shrink-0 text-[12px] font-semibold text-zinc-700">
                                  ✓
                                </span>
                              )}
                            </div>

                            <div className="text-[13px] text-zinc-600 truncate">
                              {format(date, 'EEE, MMM d')}
                              {detail ? `  •  ${detail}` : ''}
                            </div>
                          </div>

                          {/* Very subtle affordance */}
                          <ChevronIcon className="w-4 h-4 shrink-0 text-zinc-300" />
                        </button>
                      );
                    })}

                    {extras.map((a) => {
                      const date = safeParseDate(a.start_date_local);
                      const distance = a.distance ? `${(a.distance / 1609).toFixed(1)} mi` : '';
                      const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';

                      return (
                        <div key={a.id} className="px-4 py-4 flex items-center gap-3">
                          <div className="shrink-0 h-9 w-9 rounded-full bg-black/[0.04] flex items-center justify-center">
                            <span className="text-[12px] font-semibold text-zinc-700">Up</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[14px] font-semibold text-zinc-950 truncate">
                                {a.name || 'Unplanned Activity'}
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/[0.04] text-zinc-600">
                                Imported
                              </span>
                            </div>
                            <div className="text-[13px] text-zinc-600 truncate">
                              {format(date, 'EEE, MMM d')}
                              {distance ? `  •  ${distance}` : ''}
                              {hr ? `  •  ${hr}` : ''}
                            </div>
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
