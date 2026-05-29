'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import {
  addMonths,
  differenceInCalendarDays,
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

function IconSpark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M10 2.5 11.7 8l5.8 2-5.8 2L10 17.5 8.3 12l-5.8-2 5.8-2L10 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
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

function getNextSession(sessions: MergedSession[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return sessions
    .filter((session) => session.date && parseISO(session.date) >= today)
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[0] ?? null;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-950">{value}</div>
      {detail ? <div className="mt-1 text-[12px] text-zinc-500">{detail}</div> : null}
    </div>
  );
}

function AppSidebar({ raceGoal }: { raceGoal?: string | null }) {
  const items = ['Overview', 'Schedule', 'Sessions', 'Plan', 'Progress', 'Coaching'];

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-zinc-200 bg-white/85 px-4 py-5 xl:block">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-semibold text-white">T</div>
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-zinc-950">TrainGPT</div>
          <div className="text-[11px] text-zinc-500">Plans · Calendar · Strava</div>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const active = item === 'Schedule';
          return (
            <div
              key={item}
              className={`rounded-xl px-3 py-2 text-[13px] font-medium ${
                active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              {item}
            </div>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Race focus</div>
        <div className="mt-2 text-[13px] font-semibold text-zinc-950">{raceGoal || 'Current plan'}</div>
        <div className="mt-2 text-[12px] leading-5 text-zinc-500">Keep the week consistent and protect key sessions.</div>
      </div>
    </aside>
  );
}

export default function CalendarShell({
  sessions,
  completedSessions,
  extraStravaActivities = [],
  onCompletedUpdateAction,
  timezone = 'America/Los_Angeles',
  todaySummary,
  nextSummary,
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
    for (const session of localSessions) {
      if (!session.date) continue;
      if (!map[session.date]) map[session.date] = [];
      map[session.date].push(session);
    }
    Object.keys(map).forEach((dateKey) => {
      map[dateKey] = map[dateKey].slice().sort((a, b) => String(a.sport ?? '').localeCompare(String(b.sport ?? '')));
    });
    return map;
  }, [localSessions]);

  const stravaByDate = useMemo(() => normalizeStravaActivities(extraStravaActivities, timezone), [extraStravaActivities, timezone]);
  const weeklyStats = useMemo(() => getWeeklyStats(localSessions, completed), [localSessions, completed]);
  const nextSession = useMemo(() => getNextSession(localSessions), [localSessions]);
  const weekLabel = useMemo(() => {
    const now = new Date();
    return `${format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(now, { weekStartsOn: 1 }), 'MMM d')}`;
  }, []);

  const recentExecution = useMemo(() => {
    const cutoff = subDays(new Date(), 14);
    const completedKeys = new Set(
      completed.filter((item) => (item.status ?? 'done') === 'done').map((item) => `${item.date}::${item.session_title}`)
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
      <main className="min-h-[100dvh] bg-[#FAFAF7] pb-[env(safe-area-inset-bottom)]">
        <MobileCalendarView
          sessions={localSessions as any}
          completedSessions={completed}
          stravaActivities={extraStravaActivities}
          onSessionDeleted={handleSessionDeleted}
          weekPhase={weekPhaseSummary ?? null}
          raceGoal={raceGoal ?? null}
        />
      </main>
    );
  }

  const daysToRace = raceGoal && nextSession?.date ? Math.max(0, differenceInCalendarDays(parseISO(nextSession.date), new Date())) : null;

  return (
    <main className="min-h-[100dvh] bg-[#FAFAF7] text-zinc-950">
      <div className="flex min-h-[100dvh]">
        <AppSidebar raceGoal={raceGoal} />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#FAFAF7]/90 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-5 lg:px-8">
              <div className="flex items-center gap-3">
                <button type="button" onClick={goToPrevMonth} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" aria-label="Previous month">
                  <IconChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={goToNextMonth} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" aria-label="Next month">
                  <IconChevronRight className="h-5 w-5" />
                </button>
                <div className="ml-2">
                  <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950">{format(currentMonth, 'MMMM yyyy')}</h1>
                  <p className="text-[12px] text-zinc-500">{weekPhaseSummary || 'Your training calendar'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={goToToday} className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50">
                  Today
                </button>
                {onOpenWalkthroughAction ? (
                  <button type="button" onClick={onOpenWalkthroughAction} disabled={walkthroughLoading} className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                    {walkthroughLoading ? 'Opening…' : 'Walkthrough'}
                  </button>
                ) : null}
                <button type="button" onClick={() => setAddSessionDate(new Date())} className="h-9 rounded-xl bg-zinc-950 px-4 text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] hover:bg-zinc-800">
                  + Add
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-6 lg:px-8">
            <section className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Current focus
                </div>
                <h2 className="text-[24px] font-semibold tracking-tight text-zinc-950">
                  {todaySummary || nextSummary || 'Keep the week consistent.'}
                </h2>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-zinc-500">
                  {nextSession ? `Next up: ${nextSession.title}` : 'Open any session to review details, mark completion, or generate a structured workout.'}
                </p>
              </div>

              <SummaryCard label="Weekly volume" value={formatMinutes(weeklyStats.minutes)} detail={`${weeklyStats.done} of ${weeklyStats.planned} sessions done`} />
              <SummaryCard label="Adherence" value={weeklyStats.planned ? `${weeklyStats.adherence}%` : '—'} detail={weeklyStats.planned ? 'Current week' : 'No planned sessions'} />
              <SummaryCard label="Next" value={nextSummary || 'No upcoming session'} detail={nextSession?.date ? format(parseISO(nextSession.date), 'EEE, MMM d') : undefined} />
              <SummaryCard label="Race focus" value={raceGoal || 'Active plan'} detail={daysToRace !== null ? `${daysToRace} days to next key session` : undefined} />
            </section>

            {saveState !== 'idle' ? (
              <div className={`mb-4 rounded-2xl border px-4 py-3 text-[13px] font-medium ${
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
