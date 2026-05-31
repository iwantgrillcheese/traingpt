'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import {
  addMonths,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type SensorOptions,
} from '@dnd-kit/core';

import AddSessionModalTP from './AddSessionModalTP';
import MobileCalendarView from './MobileCalendarView';
import MonthGrid from './MonthGrid';
import SessionModal from './SessionModal';
import StravaActivityModal from './StravaActivityModal';

import { supabase } from '@/lib/supabase/client';
import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';

type CalendarShellProps = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  extraStravaActivities?: StravaActivity[];
  onCompletedUpdateAction?: (updated: CompletedSession[]) => void;
  timezone?: string;
  todaySummary?: string;
  nextSummary?: string;
  weekPhaseSummary?: string;
  raceGoal?: string | null;
  onOpenWalkthroughAction?: () => void;
  walkthroughLoading?: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M12.5 4.5 7.5 10l5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="m7.5 4.5 5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getCompletedKey(session: MergedSession) {
  return `${session.date}::${session.title}`;
}

function isSessionDone(session: MergedSession, completed: CompletedSession[]) {
  if (session.stravaActivity) return true;
  return completed.some(
    (item) => item.date === session.date && item.session_title === session.title && (item.status ?? 'done') === 'done'
  );
}

function getWeeklyStats(sessions: MergedSession[], completed: CompletedSession[]) {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });

  const weekSessions = sessions.filter((session) => {
    if (!session.date) return false;
    const date = parseISO(session.date);
    return date >= start && date <= end;
  });

  const done = weekSessions.filter((session) => isSessionDone(session, completed)).length;
  const planned = weekSessions.length;
  const minutes = weekSessions.reduce((total, session) => {
    const value = typeof session.duration === 'number' && Number.isFinite(session.duration) ? session.duration : 0;
    return total + value;
  }, 0);

  return {
    planned,
    done,
    minutes,
    adherence: planned > 0 ? Math.round((done / planned) * 100) : 0,
  };
}

function formatMinutes(minutes: number) {
  if (!minutes || minutes < 1) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function cleanTitle(title?: string | null) {
  return String(title ?? 'Untitled session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeSport(value?: string | null) {
  const sport = String(value ?? 'Session').toLowerCase();
  if (sport.includes('bike') || sport.includes('ride')) return 'Bike';
  if (sport.includes('run')) return 'Run';
  if (sport.includes('swim')) return 'Swim';
  if (sport.includes('strength')) return 'Strength';
  if (sport.includes('rest')) return 'Rest';
  return 'Session';
}

function getNextSession(sessions: MergedSession[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return sessions
    .filter((session) => session.date && parseISO(session.date) >= today)
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[0] ?? null;
}

function getTodaysSession(sessions: MergedSession[]) {
  const today = new Date();
  return sessions
    .filter((session) => session.date && isSameDay(parseISO(session.date), today))
    .sort((a, b) => String(a.sport ?? '').localeCompare(String(b.sport ?? '')))[0] ?? null;
}

function previewDetails(value?: string | null) {
  const text = String(value ?? '')
    .replace(/Purpose:\s*/gi, '')
    .replace(/Workout:\s*/gi, '')
    .replace(/Intensity:\s*/gi, '')
    .split(/\n|\./)
    .map((part) => part.trim())
    .find((part) => part.length > 16);

  if (!text) return 'Open the session for workout details and completion actions.';
  return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
}

function openCalendarExport() {
  window.location.href = '/api/calendar/export';
}

export default function CalendarShell({
  sessions,
  completedSessions,
  extraStravaActivities = [],
  onCompletedUpdateAction,
  timezone = 'America/Los_Angeles',
  weekPhaseSummary,
  raceGoal,
  onOpenWalkthroughAction,
  walkthroughLoading,
}: CalendarShellProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [completed, setCompleted] = useState<CompletedSession[]>(completedSessions);
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileView(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  useEffect(() => setCompleted(completedSessions), [completedSessions]);
  useEffect(() => setLocalSessions(sessions), [sessions]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    onCompletedUpdateAction?.(completed);
  }, [completed, onCompletedUpdateAction]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } } as SensorOptions),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } } as SensorOptions)
  );

  const sessionsByDate = useMemo(() => {
    const map: Record<string, MergedSession[]> = {};
    localSessions.forEach((session) => {
      if (!session.date) return;
      if (!map[session.date]) map[session.date] = [];
      map[session.date].push(session);
    });

    Object.keys(map).forEach((dateKey) => {
      map[dateKey] = map[dateKey]
        .slice()
        .sort((a, b) => String(a.sport ?? '').localeCompare(String(b.sport ?? '')));
    });

    return map;
  }, [localSessions]);

  const stravaByDate = useMemo(() => normalizeStravaActivities(extraStravaActivities, timezone), [extraStravaActivities, timezone]);
  const todaySession = useMemo(() => getTodaysSession(localSessions), [localSessions]);
  const nextSession = useMemo(() => getNextSession(localSessions), [localSessions]);
  const commandSession = todaySession ?? nextSession;
  const weeklyStats = useMemo(() => getWeeklyStats(localSessions, completed), [localSessions, completed]);

  const weekLabel = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return `${format(weekStart, 'MMM d')}–${format(weekEnd, 'MMM d')}`;
  }, []);

  const recentExecution = useMemo(() => {
    const cutoff = subDays(new Date(), 14);
    const completedKeys = new Set(
      completed
        .filter((item) => (item.status ?? 'done') === 'done')
        .map((item) => `${item.date}::${item.session_title}`)
    );

    const recentCompleted = localSessions.filter((session) => {
      if (!session.date || !session.title) return false;
      const date = parseISO(session.date);
      return isAfter(date, cutoff) && (Boolean(session.stravaActivity) || completedKeys.has(getCompletedKey(session)));
    }).length;

    const recentMissed = localSessions.filter((session) => {
      if (!session.date || !session.title) return false;
      const date = parseISO(session.date);
      if (isAfter(date, new Date()) || !isAfter(date, cutoff)) return false;
      return !(Boolean(session.stravaActivity) || completedKeys.has(getCompletedKey(session)));
    }).length;

    return { recentCompleted, recentMissed };
  }, [localSessions, completed]);

  const goToPrevMonth = () => setCurrentMonth((month) => subMonths(month, 1));
  const goToNextMonth = () => setCurrentMonth((month) => addMonths(month, 1));
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()));

  const handleSessionAdded = (newSession: MergedSession) => {
    setLocalSessions((prev) => [...prev, newSession]);
  };

  const handleSessionDeleted = (sessionId: string) => {
    setLocalSessions((prev) => prev.filter((session) => String(session.id) !== String(sessionId)));
    setSelectedSession((prev) => (prev && String(prev.id) === String(sessionId) ? null : prev));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;

    const draggedId = String(active.id);
    const targetDate = String(over.id);
    let previousDate: string | null = null;

    setLocalSessions((prev) =>
      prev.map((session) => {
        if (String(session.id) !== draggedId) return session;
        previousDate = String(session.date ?? '');
        return { ...session, date: targetDate };
      })
    );

    setSaveState('saving');
    setSaveMessage('Saving schedule change…');

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('sessions').update({ date: targetDate }).eq('id', draggedId);

      if (error) {
        console.error('[CalendarShell] error persisting session move:', error);
        if (previousDate) {
          setLocalSessions((prev) =>
            prev.map((session) => (String(session.id) === draggedId ? { ...session, date: previousDate as string } : session))
          );
        }
        setSaveState('error');
        setSaveMessage('Could not save that move. Reverted to the original day.');
        return;
      }

      setSaveState('saved');
      setSaveMessage('Saved');
      window.setTimeout(() => {
        setSaveState('idle');
        setSaveMessage('');
      }, 1200);
    }, 450);
  };

  if (!hasMounted) return <main className="min-h-[100dvh] bg-white" />;

  if (isMobileView) {
    return (
      <main className="min-h-[100dvh] bg-white pb-[env(safe-area-inset-bottom)]">
        <MobileCalendarView
          sessions={localSessions}
          completedSessions={completed}
          stravaActivities={extraStravaActivities}
          onSessionDeleted={handleSessionDeleted}
          weekPhase={weekPhaseSummary ?? null}
          raceGoal={raceGoal ?? null}
        />
      </main>
    );
  }

  const nextTitle = nextSession ? cleanTitle(nextSession.title) : null;
  const nextDate = nextSession?.date ? format(parseISO(nextSession.date), 'EEE, MMM d') : null;
  const commandDate = commandSession?.date ? format(parseISO(commandSession.date), 'EEE, MMM d') : null;
  const commandDuration = commandSession?.duration ? formatMinutes(Number(commandSession.duration)) : null;

  return (
    <main className="min-h-[100dvh] bg-[#fbfbfa] text-zinc-950">
      <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#fbfbfa]/90 backdrop-blur-xl">
            <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-4 lg:px-8">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-[24px] font-semibold tracking-tight text-zinc-950">Schedule</h1>
                  <span className="hidden text-[13px] text-zinc-400 sm:inline">/</span>
                  <span className="hidden text-[13px] font-medium text-zinc-500 sm:inline">{format(currentMonth, 'MMMM yyyy')}</span>
                </div>
                <p className="mt-1 truncate text-[13px] text-zinc-500">
                  {nextTitle ? `Next: ${nextTitle}${nextDate ? ` · ${nextDate}` : ''}` : 'Your training calendar'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={goToPrevMonth} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" aria-label="Previous month">
                  <IconChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={goToNextMonth} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" aria-label="Next month">
                  <IconChevronRight className="h-5 w-5" />
                </button>
                <button type="button" onClick={goToToday} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50">
                  Today
                </button>
                <button type="button" onClick={openCalendarExport} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50">
                  Export
                </button>
                {onOpenWalkthroughAction ? (
                  <button type="button" onClick={onOpenWalkthroughAction} disabled={walkthroughLoading} className="hidden h-9 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:block">
                    {walkthroughLoading ? 'Opening…' : 'Walkthrough'}
                  </button>
                ) : null}
                <button type="button" onClick={() => setAddSessionDate(new Date())} className="h-9 rounded-lg bg-zinc-950 px-4 text-[13px] font-semibold text-white hover:bg-zinc-800">
                  + Add
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-200 px-5 py-2 lg:px-8">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-zinc-500">
                <span>{weekPhaseSummary || 'Active training block'}</span>
                <span>{weeklyStats.planned ? `${weeklyStats.done}/${weeklyStats.planned} sessions complete` : 'No sessions this week'}</span>
                <span>{weeklyStats.minutes ? `${formatMinutes(weeklyStats.minutes)} planned` : 'Volume not set'}</span>
                <span>{weeklyStats.planned ? `${weeklyStats.adherence}% adherence` : null}</span>
              </div>
            </div>
          </header>

          <div className="px-5 py-5 lg:px-8">
            {commandSession ? (
              <section className="mb-5 overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
                  <button
                    type="button"
                    onClick={() => setSelectedSession(commandSession)}
                    className="p-5 text-left transition hover:bg-zinc-50 lg:p-6"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      {todaySession ? 'Today' : 'Next up'}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-medium text-zinc-500">
                      <span>{normalizeSport(commandSession.sport)}</span>
                      {commandDate ? <span>· {commandDate}</span> : null}
                      {commandDuration ? <span>· {commandDuration}</span> : null}
                      {raceGoal ? <span>· {raceGoal}</span> : null}
                    </div>
                    <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.045em] text-zinc-950">
                      {cleanTitle(commandSession.title)}
                    </h2>
                    <p className="mt-3 max-w-2xl text-[14px] leading-6 text-zinc-500">
                      {previewDetails(commandSession.details)}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white">Open session</span>
                      <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700">Generate details</span>
                    </div>
                  </button>

                  <div className="border-t border-zinc-200 bg-[#fbfaf8] p-5 lg:border-l lg:border-t-0 lg:p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">This week</div>
                    <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-1">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="text-[11px] font-medium text-zinc-400">Complete</div>
                        <div className="mt-1 text-xl font-semibold tracking-[-0.04em] text-zinc-950">{weeklyStats.done}/{weeklyStats.planned || 0}</div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="text-[11px] font-medium text-zinc-400">Volume</div>
                        <div className="mt-1 text-xl font-semibold tracking-[-0.04em] text-zinc-950">{weeklyStats.minutes ? formatMinutes(weeklyStats.minutes) : '—'}</div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="text-[11px] font-medium text-zinc-400">Adherence</div>
                        <div className="mt-1 text-xl font-semibold tracking-[-0.04em] text-zinc-950">{weeklyStats.planned ? `${weeklyStats.adherence}%` : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {saveState !== 'idle' ? (
              <div className={`mb-4 rounded-xl border px-4 py-3 text-[13px] font-medium ${
                saveState === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : saveState === 'saving'
                    ? 'border-zinc-200 bg-white text-zinc-600'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                {saveMessage}
              </div>
            ) : null}

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <MonthGrid
                currentMonth={currentMonth}
                sessionsByDate={sessionsByDate}
                completedSessions={completed}
                stravaByDate={stravaByDate}
                onSessionClick={setSelectedSession}
                onStravaActivityClick={setSelectedActivity}
                onAddSessionClick={setAddSessionDate}
              />
            </DndContext>
          </div>
        </div>

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        completedSessions={completed}
        onCompletedUpdate={(updatedList) => setCompleted(updatedList)}
        weekLabel={weekLabel}
        weekPhase={weekPhaseSummary ?? null}
        raceGoal={raceGoal ?? null}
        recentCompleted={recentExecution.recentCompleted}
        recentMissed={recentExecution.recentMissed}
        onSessionDeleted={handleSessionDeleted}
        onSessionUpdated={(updatedSession) => {
          setLocalSessions((prev) => prev.map((session) => (String(session.id) === String(updatedSession.id) ? { ...session, details: updatedSession.details, structured_workout: updatedSession.structured_workout } : session)));
          setSelectedSession((prev) => (prev && String(prev.id) === String(updatedSession.id) ? { ...prev, details: updatedSession.details, structured_workout: updatedSession.structured_workout } : prev));
        }}
      />

      <StravaActivityModal activity={selectedActivity} open={!!selectedActivity} onClose={() => setSelectedActivity(null)} timezone={timezone} />

      <AddSessionModalTP
        open={!!addSessionDate}
        date={addSessionDate ?? new Date()}
        onClose={() => setAddSessionDate(null)}
        onAdded={(newSession: MergedSession) => {
          handleSessionAdded(newSession);
          setAddSessionDate(null);
        }}
      />
    </main>
  );
}
