'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, endOfWeek, format, isAfter, isBefore, parseISO, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type SensorOptions } from '@dnd-kit/core';
import Link from 'next/link';
import AddSessionModalTP from './AddSessionModalTP';
import MonthGrid from './MonthGrid';
import MonthAgenda from './MonthAgenda';
import SessionModal from './SessionModal';
import MobileSessionModal from './MobileSessionModalV2';
import StravaActivityModal from './StravaActivityModal';
import CoachUpdateCard from '@/app/components/CoachUpdateCard';
import { supabase } from '@/lib/supabase/client';
import { exportCalendarClient } from '@/utils/exportCalendarClient';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';
import { formatTrainingMinutes, monthTrainingSummary, sessionStatus } from './calendar-utils';
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
};
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const controlClass = 'h-10 rounded-xl border border-[#E3E0D8] bg-white px-3 text-sm font-medium text-[#4B5563] transition hover:bg-[#F7F6F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101114]';

export default function CalendarShellV2({ sessions, completedSessions, extraStravaActivities = [], onCompletedUpdateAction, timezone = 'America/Los_Angeles', weekPhaseSummary, raceGoal, raceDate = null, onOpenWalkthroughAction, walkthroughLoading }: Props) {
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
  const summary = useMemo(() => monthTrainingSummary(localSessions, completed, currentMonth), [localSessions, completed, currentMonth]);
  const stravaByDate = useMemo(() => normalizeStravaActivities(extraStravaActivities, timezone), [extraStravaActivities, timezone]);
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, MergedSession[]> = {};
    localSessions.forEach(session => { if (session.date) (grouped[session.date] ??= []).push(session); });
    return grouped;
  }, [localSessions]);
  const recentMissed = useMemo(() => {
    const cutoff = subDays(new Date(), 14);
    return localSessions.filter(session => session.date && isAfter(parseISO(session.date), cutoff) && isBefore(parseISO(session.date), startOfDay(new Date())) && sessionStatus(session, completed) !== 'done').length;
  }, [localSessions, completed]);
  // Week context belongs to the opened session, not a separate calendar view.
  const sessionWeekStart = startOfWeek(selectedSession ? parseISO(selectedSession.date) : currentMonth, { weekStartsOn: 1 });
  const weekLabel = format(sessionWeekStart, 'MMM d') + '–' + format(endOfWeek(sessionWeekStart, { weekStartsOn: 1 }), 'MMM d');
  const raceHasPassed = raceDate ? isBefore(parseISO(raceDate), startOfDay(new Date())) : false;

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
    let previousDate: string | null = null;
    setLocalSessions(prev => prev.map(session => {
      if (String(session.id) !== draggedId) return session;
      previousDate = session.date;
      return { ...session, date: targetDate };
    }));
    setSaveState('saving');
    setSaveMessage('Saving schedule change…');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('sessions').update({ date: targetDate }).eq('id', draggedId);
      if (error) {
        console.error('[CalendarShell] error persisting session move:', error);
        if (previousDate) setLocalSessions(prev => prev.map(session => String(session.id) === draggedId ? { ...session, date: previousDate as string } : session));
        setSaveState('error');
        setSaveMessage('Could not save that move. Reverted to the original day.');
        return;
      }
      setSaveState('saved');
      setSaveMessage('Saved');
      window.setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 1200);
    }, 450);
  };

  if (!mounted) return <div className="min-h-[60vh] bg-[#F7F6F2]" />;
  const calendarProps = { currentMonth, sessionsByDate, completedSessions: completed, stravaByDate, onSessionClick: setSelectedSession, onStravaActivityClick: setSelectedActivity, onAddSessionClick: setAddSessionDate };
  const modalProps = { session: selectedSession, stravaActivity: selectedSession?.stravaActivity, open: !!selectedSession, onClose: () => setSelectedSession(null), completedSessions: completed, onCompletedUpdate: setCompleted, weekPhase: weekPhaseSummary ?? null, raceGoal: raceGoal ?? null, onSessionDeleted: handleSessionDeleted, onSessionUpdated: handleSessionUpdated };

  return (
    <div className="min-h-[100dvh] bg-[#F7F6F2] pb-[env(safe-area-inset-bottom)] text-[#101114]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.055em]">Schedule</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Your training, one month at a time.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCalendarExport} disabled={exporting} className={controlClass}>{exporting ? 'Sharing…' : 'Export'}</button>
            {onOpenWalkthroughAction ? <button type="button" onClick={onOpenWalkthroughAction} disabled={walkthroughLoading} className={controlClass}>{walkthroughLoading ? 'Opening…' : 'Walkthrough'}</button> : null}
            <button type="button" onClick={() => setAddSessionDate(new Date())} className="h-10 rounded-xl bg-[#101114] px-4 text-sm font-semibold text-white hover:bg-[#303136]">+ Add session</button>
          </div>
        </header>
        <section aria-label="Month navigation" className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 aria-live="polite" className="text-2xl font-semibold tracking-[-0.045em]">{format(currentMonth, 'MMMM yyyy')}</h2>
            {weekPhaseSummary || raceGoal ? <p className="mt-1 text-xs text-[#6B7280]">{[weekPhaseSummary, raceGoal].filter(Boolean).join(' · ')}</p> : null}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous month" onClick={() => setCurrentMonth(month => subMonths(month, 1))} className={controlClass}>‹</button>
            <button type="button" onClick={() => setCurrentMonth(startOfMonth(new Date()))} className={controlClass}>Today</button>
            <button type="button" aria-label="Next month" onClick={() => setCurrentMonth(month => addMonths(month, 1))} className={controlClass}>›</button>
          </div>
        </section>
        <section aria-label="Monthly training summary" className="mb-5 rounded-2xl border border-[#E3E0D8] bg-white px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div><dt className="text-xs text-[#6B7280]">Planned volume</dt><dd className="mt-1 text-xl font-semibold tracking-tight">{formatTrainingMinutes(summary.plannedMinutes) ?? '0m'}</dd></div>
            <div><dt className="text-xs text-[#6B7280]">Completed volume</dt><dd className="mt-1 text-xl font-semibold tracking-tight">{formatTrainingMinutes(summary.completedMinutes) ?? '0m'}</dd></div>
            <div><dt className="text-xs text-[#6B7280]">Workouts completed</dt><dd className="mt-1 text-xl font-semibold tracking-tight">{summary.done}<span className="text-sm font-normal text-[#9CA3AF]"> / {summary.planned}</span></dd></div>
            <div><dt className="text-xs text-[#6B7280]">Completion</dt><dd className="mt-1 text-xl font-semibold tracking-tight">{summary.completion}%</dd></div>
          </dl>
        </section>
        <CoachUpdateCard />
        <p className="mb-5 border-l-2 border-[#E3E0D8] pl-3 text-xs leading-5 text-[#6B7280]"><span className="font-semibold text-[#101114]">Coach note</span> · {recentMissed > 0 ? 'Missed sessions are absorbed, not stacked. Consistency beats catching up.' : 'Stay consistent and the Sunday adjustment can safely progress your plan.'}</p>
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
