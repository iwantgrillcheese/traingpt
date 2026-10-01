'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, differenceInCalendarDays, endOfWeek, format, isAfter, isBefore, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type SensorOptions } from '@dnd-kit/core';
import Link from 'next/link';
import AddSessionModalTP from './AddSessionModalTP';
import MonthGrid from './MonthGrid';
import MonthAgenda from './MonthAgenda';
import SessionModal from './SessionModal';
import MobileSessionModal from './MobileSessionModalV2';
import StravaActivityModal from './StravaActivityModal';
import CoachUpdateCard from '@/app/components/CoachUpdateCard';
import TrainingStateControls from './TrainingStateControls';
import { dateIsPaused, type TrainingPause } from '@/utils/trainingPause';
import { findCompletion } from '@/utils/sessionCompletion';
import { track } from '@/lib/analytics/posthog-client';
import { exportCalendarClient } from '@/utils/exportCalendarClient';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';
import { calendarSport, formatTrainingMinutes, isRestSession, sessionStatus, workoutTitle } from './calendar-utils';
import type { CompletedSession, Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';

type Props = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  extraStravaActivities?: StravaActivity[];
  onCompletedUpdateAction?: (updated: CompletedSession[]) => void;
  timezone?: string;
  weekPhaseSummary?: string;
  raceGoal?: string | null;
  raceDate?: string | null;
  onOpenWalkthroughAction?: () => void;
  walkthroughLoading?: boolean;
  pauses?: TrainingPause[];
  planId?: string;
};
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const controlClass = 'h-10 rounded-xl border border-[#E3E0D8] bg-white px-3 text-sm font-medium text-[#4B5563] transition hover:bg-[#F7F6F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101114]';

function raceDisplayTitle(goal?: string | null) {
  if (!goal) return 'Your race';
  if (/70\.3|half iron/i.test(goal)) return 'Your 70.3 race';
  if (/ironman|full/i.test(goal)) return 'Your Ironman race';
  if (/olympic/i.test(goal)) return 'Your Olympic triathlon';
  if (/sprint/i.test(goal)) return 'Your Sprint triathlon';
  return goal;
}

function sessionPurpose(session: MergedSession) {
  const copy = String(session.purpose || session.coach_note || session.details || '')
    .replace(/^(Purpose|Workout|Intensity):\s*/i, '').replace(/\s+/g, ' ').trim();
  const sentence = copy.split(/(?<=[.!?])\s+/)[0];
  return sentence || 'Open the session for workout structure and targets.';
}

export default function CalendarShellV2({ sessions, completedSessions, extraStravaActivities = [], onCompletedUpdateAction, timezone = 'America/Los_Angeles', weekPhaseSummary, raceGoal, raceDate = null, onOpenWalkthroughAction, walkthroughLoading, pauses = [], planId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);
  const [completed, setCompleted] = useState<CompletedSession[]>(completedSessions);
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const pendingMoves = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setCompleted(completedSessions), [completedSessions]);
  useEffect(() => setLocalSessions(sessions), [sessions]);
  useEffect(() => onCompletedUpdateAction?.(completed), [completed, onCompletedUpdateAction]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } } as SensorOptions),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } } as SensorOptions),
  );
  const today = startOfDay(new Date());
  const trainingWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const trainingWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weeklySessions = localSessions.filter(session => session.date && !dateIsPaused(session.date, pauses) && !isRestSession(session) && parseISO(session.date) >= trainingWeekStart && parseISO(session.date) <= trainingWeekEnd);
  const weeklyMinutes = weeklySessions.reduce((sum, session) => sum + Math.max(0, session.duration ?? 0), 0);
  const weeklyDone = weeklySessions.filter(session => sessionStatus(session, completed) === 'done').length;
  const weeklyCompletion = weeklySessions.length ? Math.round(weeklyDone / weeklySessions.length * 100) : 0;
  const trainingWeekLabel = `${format(trainingWeekStart, 'MMM d')} – ${format(trainingWeekEnd, 'MMM d')}`;
  const commandSession = localSessions.filter(session => session.date && parseISO(session.date) >= today && !isRestSession(session) && !sessionStatus(session, completed))
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const parsedRaceDate = raceDate ? parseISO(raceDate) : null;
  const validRaceDate = parsedRaceDate && !Number.isNaN(parsedRaceDate.getTime()) ? parsedRaceDate : null;
  const raceCountdown = validRaceDate ? Math.max(0, differenceInCalendarDays(validRaceDate, today)) : null;
  const stravaByDate = useMemo(() => normalizeStravaActivities(extraStravaActivities, timezone), [extraStravaActivities, timezone]);
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, MergedSession[]> = {};
    localSessions.forEach(session => { if (session.date) (grouped[session.date] ??= []).push(session); });
    return grouped;
  }, [localSessions]);
  const recentMissed = useMemo(() => {
    const cutoff = subDays(new Date(), 14);
    return localSessions.filter(session => session.date && !dateIsPaused(session.date, pauses) && !isRestSession(session) && isAfter(parseISO(session.date), cutoff) && isBefore(parseISO(session.date), startOfDay(new Date())) && sessionStatus(session, completed) !== 'done').length;
  }, [localSessions, completed, pauses]);
  // Week context belongs to the opened session, not a separate calendar view.
  const sessionWeekStart = startOfWeek(selectedSession ? parseISO(selectedSession.date) : currentMonth, { weekStartsOn: 1 });
  const weekLabel = format(sessionWeekStart, 'MMM d') + '–' + format(endOfWeek(sessionWeekStart, { weekStartsOn: 1 }), 'MMM d');
  const raceHasPassed = validRaceDate ? isBefore(validRaceDate, today) : false;

  const handleCalendarExport = async () => {
    try { setExporting(true); await exportCalendarClient(); } finally { setExporting(false); }
  };
  const handleSessionDeleted = (sessionId: string) => {
    setLocalSessions(prev => prev.filter(session => String(session.id) !== String(sessionId)));
    setSelectedSession(prev => prev && String(prev.id) === String(sessionId) ? null : prev);
  };
  const handleSessionUpdated = (updated: Session) => {
    setLocalSessions(prev => prev.map(session => String(session.id) === String(updated.id) ? { ...session, ...updated } : session));
    setSelectedSession(prev => prev && String(prev.id) === String(updated.id) ? { ...prev, ...updated } : prev);
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;
    const draggedId = String(active.id);
    const targetDate = String(over.id);
    const original = localSessions.find(session => String(session.id) === draggedId);
    if (!original || original.date === targetDate || pendingMoves.current.has(draggedId)) return;
    const previousDate = original.date;
    const originalCompletion = findCompletion(completed, original);
    const promoted = originalCompletion && !originalCompletion.session_id;
    pendingMoves.current.add(draggedId);
    if (promoted) setCompleted(prev => prev.map(row => row === originalCompletion ? { ...row, session_id: draggedId } : row));
    setLocalSessions(prev => prev.map(session => String(session.id) === draggedId ? { ...session, date: targetDate } : session));
    setSaveState('saving');
    setSaveMessage('Saving schedule change…');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const response = await fetch('/api/schedule/update-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: draggedId, newDate: targetDate }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save that move.');
      setSaveState('saved');
      setSaveMessage('Saved');
      saveTimer.current = setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 1200);
    } catch (error) {
      if (promoted) setCompleted(prev => prev.map(row => row.session_id === draggedId && row.date === originalCompletion.date && row.session_title === originalCompletion.session_title ? { ...row, session_id: null } : row));
      setLocalSessions(prev => prev.map(session => String(session.id) === draggedId ? { ...session, date: previousDate } : session));
      setSaveState('error');
      setSaveMessage(`${error instanceof Error ? error.message : 'Could not save that move.'} Reverted to the original day.`);
    } finally { pendingMoves.current.delete(draggedId); }
  };

  if (!mounted) return <div className="min-h-[60vh] bg-[#F7F6F2]" />;
  const calendarProps = { currentMonth, sessionsByDate, completedSessions: completed, stravaByDate, onSessionClick: setSelectedSession, onStravaActivityClick: setSelectedActivity, onAddSessionClick: setAddSessionDate };
  const modalProps = { session: selectedSession, stravaActivity: selectedSession?.stravaActivity, open: !!selectedSession, onClose: () => setSelectedSession(null), completedSessions: completed, onCompletedUpdate: setCompleted, weekPhase: weekPhaseSummary ?? null, raceGoal: raceGoal ?? null, onSessionDeleted: handleSessionDeleted, onSessionUpdated: handleSessionUpdated };

  return (
    <div className="min-h-[100dvh] bg-[#F7F7FB] pb-[env(safe-area-inset-bottom)] text-[#11121A]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <CoachUpdateCard />
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[32px] font-black leading-none tracking-[-0.07em]">Schedule <span className="text-lg font-bold leading-none text-[#9EA4B7]">/ Season {today.getFullYear()}</span></h1>
            <p className="mt-1 text-sm text-[#6B7280]">{commandSession ? `Next: ${workoutTitle(commandSession.title)}` : 'No upcoming sessions'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCalendarExport} disabled={exporting} className={controlClass}>{exporting ? 'Sharing…' : 'Export'}</button>
            <Link href="/plan/print" className={`${controlClass} inline-flex items-center`} onClick={() => track('plan_print_clicked', { source: 'schedule' })}>Print plan</Link>
            {planId ? <TrainingStateControls planId={planId} onChanged={() => window.location.reload()} /> : null}
            {onOpenWalkthroughAction ? <button type="button" onClick={onOpenWalkthroughAction} disabled={walkthroughLoading} className={controlClass}>{walkthroughLoading ? 'Opening…' : 'Walkthrough'}</button> : null}
            <button type="button" onClick={() => setAddSessionDate(new Date())} className="h-10 rounded-xl bg-[#101114] px-4 text-sm font-semibold text-white hover:bg-[#303136]">+ Add session</button>
          </div>
        </header>
        <section aria-label="Training overview" className="mb-4 grid gap-4 lg:grid-cols-[1.05fr_1.3fr]">
          <div className="rounded-[24px] bg-[#090A12] px-5 py-[18px] text-white shadow-[0_18px_40px_rgba(8,10,18,0.16)] lg:min-h-[150px]">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A9ADF3]">◎ Target race</div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[25px] font-black leading-7 tracking-[-0.055em]">{raceDisplayTitle(raceGoal)}</h2>
              <div className="flex items-center gap-3">
              <div className="text-[42px] font-black leading-none tracking-[-0.08em]">{raceCountdown ?? '—'}</div>
              <div className="text-sm font-semibold leading-snug text-[#C7CAE1]">{raceCountdown !== null ? 'days out' : 'plan active'}<br />{validRaceDate ? format(validRaceDate, 'EEE, MMM d') : 'Add race date'}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#AEB2C7]"><span>{trainingWeekLabel} · {weekPhaseSummary || 'Active training block'}</span><span>{weeklyCompletion}%</span></div>
            <div role="progressbar" aria-label="Weekly workout completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weeklyCompletion} className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.12]"><div className="h-full rounded-full bg-[#9E92FF]" style={{ width: `${weeklyCompletion}%` }} /></div>
          </div>
          <div className="rounded-[24px] bg-[#090A12] px-5 py-[18px] text-white shadow-[0_18px_40px_rgba(8,10,18,0.16)]">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-black text-[#D8DBEF]">Weekly load</h2><p className="mt-1 text-xs font-semibold text-[#8C90AA]">planned by sport · {trainingWeekLabel}</p></div><span className="text-[15px] font-black">{formatTrainingMinutes(weeklyMinutes) ?? '0m'} planned</span></div>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['Swim', 'Bike', 'Run', 'Strength'] as const).map((sport, index) => {
                const minutes = weeklySessions.filter(session => calendarSport(session.sport) === sport).reduce((sum, session) => sum + Math.max(0, session.duration ?? 0), 0);
                return <div key={sport} className="rounded-2xl bg-white/[0.08] px-3 py-2"><dt className="flex items-center gap-1.5 text-xs font-bold text-[#BFC3D8]"><span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: ['#34B7F1', '#9B7CF6', '#2FCB90', '#C084FC'][index] }} />{sport}</dt><dd className="mt-1 text-[15px] font-black">{formatTrainingMinutes(minutes) ?? '0m'}</dd></div>;
              })}
            </dl>
          </div>
        </section>
        <div className="mb-2 grid items-start gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
        <section aria-label="Coach notice" className="flex min-h-[56px] items-center gap-3 rounded-[18px] border border-[#D7D8FF] bg-gradient-to-r from-[#F7F7FF] to-white px-4 py-2 lg:order-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#7667FF] to-[#A798FF] text-white">✣</div>
          <div><div className="text-[11px] font-black uppercase tracking-[0.13em] text-[#4F46E5]">{recentMissed > 0 ? 'Coach adjusted this week' : 'Coach is watching this week'}</div><p className="mt-0.5 text-sm leading-5 text-[#31364A]">{recentMissed > 0 ? 'Missed sessions absorbed, not stacked.' : 'Consistency helps your plan progress.'}</p></div>
        </section>
        {commandSession ? <section aria-label="Next session" className="grid items-center gap-3 rounded-[22px] border border-[#D8D6FF] bg-gradient-to-br from-[#F8F7FF] to-white px-4 py-3 lg:order-1 lg:min-h-[108px] xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="min-w-0 border-l-4 border-[#9B7CF6] pl-3"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5146F0]">{isSameDay(parseISO(commandSession.date), today) ? 'Today' : 'Next'} · {calendarSport(commandSession.sport)}</div><h2 className="mt-1 text-2xl font-black leading-7 tracking-[-0.055em]">{workoutTitle(commandSession.title)}</h2><p className="mt-1 text-sm leading-5 text-[#687085] xl:truncate" title={sessionPurpose(commandSession)}>{sessionPurpose(commandSession)}</p></div>
          <dl className="flex gap-4 xl:col-span-2"><div><dt className="text-xs text-[#70778B]">Planned duration</dt><dd className="mt-1 text-lg font-bold">{formatTrainingMinutes(commandSession.duration) ?? 'See workout'}</dd></div><div><dt className="text-xs text-[#70778B]">Scheduled date</dt><dd className="mt-1 text-lg font-bold">{format(parseISO(commandSession.date), 'EEE, MMM d')}</dd></div></dl>
          <div className="flex items-center gap-3 xl:flex-col xl:gap-1"><button type="button" onClick={() => setSelectedSession(commandSession)} className="h-10 rounded-xl bg-[#2F64FF] px-4 text-sm font-bold text-white">Open session</button><button type="button" onClick={() => setAddSessionDate(parseISO(commandSession.date))} className="px-3 py-1 text-xs font-semibold text-[#4B5563] hover:underline">Add nearby</button></div>
        </section> : null}
        </div>
        <section aria-label="Month navigation" className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Previous month" onClick={() => setCurrentMonth(month => subMonths(month, 1))} className={controlClass}>‹</button>
            <button type="button" aria-label="Next month" onClick={() => setCurrentMonth(month => addMonths(month, 1))} className={controlClass}>›</button>
            <button type="button" onClick={() => setCurrentMonth(startOfMonth(new Date()))} className={controlClass}>Today</button>
            <h2 aria-live="polite" className="ml-1 text-xl font-black tracking-[-0.045em]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <span className="text-sm text-[#6B7280]">{trainingWeekLabel}{weekPhaseSummary ? ` · ${weekPhaseSummary}` : ''}</span>
          </div>
          <span className="text-xs font-semibold text-[#666D81]">{weeklyDone}/{weeklySessions.length} done this week</span>
        </section>
        {raceHasPassed ? <div className="mb-5 rounded-xl border border-[#E3E0D8] bg-white px-4 py-3 text-sm text-[#6B7280]">Your race date has passed. <Link href="/plan" className="font-semibold text-[#101114] underline underline-offset-4">Plan your next race</Link></div> : null}
        {saveState !== 'idle' ? <div role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${saveState === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[#E3E0D8] bg-white text-[#6B7280]'}`}>{saveMessage}</div> : null}
        {mobile ? <MonthAgenda {...calendarProps} /> : <DndContext sensors={sensors} onDragEnd={handleDragEnd}><MonthGrid {...calendarProps} /></DndContext>}
      </div>
      {mobile ? <MobileSessionModal {...modalProps} /> : <SessionModal {...modalProps} weekLabel={weekLabel} recentMissed={recentMissed} />}
      <StravaActivityModal activity={selectedActivity} open={!!selectedActivity} onClose={() => setSelectedActivity(null)} timezone={timezone} />
      <AddSessionModalTP open={!!addSessionDate} date={addSessionDate ?? new Date()} onClose={() => setAddSessionDate(null)} onAdded={(newSession: MergedSession) => { setLocalSessions(prev => [...prev, newSession]); setAddSessionDate(null); }} />
    </div>
  );
}
