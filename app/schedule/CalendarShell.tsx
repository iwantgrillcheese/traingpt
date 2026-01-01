'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import StravaActivityModal from './StravaActivityModal';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';
import { supabase } from '@/lib/supabase-client';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type SensorOptions,
} from '@dnd-kit/core';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type CalendarShellProps = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  stravaActivities: StravaActivity[]; // not used directly in day rendering
  extraStravaActivities: StravaActivity[];
  onCompletedUpdate?: (updated: CompletedSession[]) => void;
  timezone?: string;

  onOpenWalkthrough?: () => void;
  walkthroughLoading?: boolean;
};

class NoopSensor {
  static activators: any[] = [];
  constructor() {}
}

function IconChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12.5 4.5L7.5 10l5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7.5 4.5l5 5.5-5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Toolbar({
  currentMonth,
  onPrev,
  onNext,
  onOpenWalkthrough,
  walkthroughLoading,
}: {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onOpenWalkthrough?: () => void;
  walkthroughLoading?: boolean;
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur">
      <div className="w-full px-6 lg:px-10">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Glassy nav pills */}
            <div className="inline-flex items-center rounded-full border border-black/10 bg-white/70 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden">
              <button
                onClick={onPrev}
                className="inline-flex h-9 w-10 items-center justify-center text-zinc-700 hover:bg-black/[0.03] active:bg-black/[0.05]"
                aria-label="Previous month"
              >
                <IconChevronLeft className="h-5 w-5" />
              </button>
              <div className="h-6 w-px bg-black/10" />
              <button
                onClick={onNext}
                className="inline-flex h-9 w-10 items-center justify-center text-zinc-700 hover:bg-black/[0.03] active:bg-black/[0.05]"
                aria-label="Next month"
              >
                <IconChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="ml-1 leading-tight">
              <div className="text-[16px] font-semibold tracking-tight text-zinc-950">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <div className="text-[12px] text-zinc-500">
                Drag & drop to reschedule
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenWalkthrough ? (
              <button
                type="button"
                onClick={onOpenWalkthrough}
                disabled={walkthroughLoading}
                className="h-9 rounded-full border border-black/10 bg-white/70 backdrop-blur px-4 text-[13px] font-medium text-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-white active:bg-black/[0.03] transition disabled:opacity-50"
              >
                {walkthroughLoading ? 'Opening…' : 'Walkthrough'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarShell({
  sessions,
  completedSessions,
  extraStravaActivities = [],
  onCompletedUpdate,
  timezone = 'America/Los_Angeles',
  onOpenWalkthrough,
  walkthroughLoading,
}: CalendarShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  const [completed, setCompleted] = useState<CompletedSession[]>(completedSessions);
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setCompleted(completedSessions), [completedSessions]);
  useEffect(() => setLocalSessions(sessions), [sessions]);

  useEffect(() => {
    onCompletedUpdate?.(completed);
  }, [completed, onCompletedUpdate]);

  useEffect(() => {
    setHasMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // only mount real sensors on desktop
  const sensors = useSensors(
    useSensor(isMobile ? (NoopSensor as any) : MouseSensor, {
      activationConstraint: { distance: 8 },
    } as SensorOptions),
    useSensor(isMobile ? (NoopSensor as any) : TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    } as SensorOptions)
  );

  const sessionsByDate = useMemo(() => {
    const map: Record<string, MergedSession[]> = {};
    localSessions.forEach((s) => {
      if (!s.date) return;
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });

    // deterministic order within a day
    Object.keys(map).forEach((k) => {
      map[k] = map[k]
        .slice()
        .sort((a, b) => String(a.sport ?? '').localeCompare(String(b.sport ?? '')));
    });

    return map;
  }, [localSessions]);

  const stravaByDate: Record<string, StravaActivity[]> = useMemo(() => {
    return normalizeStravaActivities(extraStravaActivities, timezone);
  }, [extraStravaActivities, timezone]);

  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const handleSessionClick = (session: MergedSession) => setSelectedSession(session);
  const handleStravaActivityClick = (activity: StravaActivity) => setSelectedActivity(activity);

  const handleSessionAdded = (newSession: any) => {
    setLocalSessions((prev) => [...prev, newSession]);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!active || !over) return;

    const draggedId = active.id;
    const targetDate = over.id;

    setLocalSessions((prev) =>
      prev.map((s) => (s.id === draggedId ? { ...s, date: targetDate } : s))
    );

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('sessions')
        .update({ date: targetDate })
        .eq('id', draggedId);

      if (error) console.error('Error persisting session move:', error);
    }, 450);
  };

  if (!hasMounted) {
    return <main className="min-h-[100dvh] w-full bg-white" />;
  }

  return (
    <main className="min-h-[100dvh] w-full bg-zinc-50 pb-[env(safe-area-inset-bottom)]">
      {isMobile ? (
        <div className="px-0">
          <MobileCalendarView
            sessions={localSessions as any}
            completedSessions={completed}
            stravaActivities={extraStravaActivities}
          />
        </div>
      ) : (
        <>
          <Toolbar
            currentMonth={currentMonth}
            onPrev={goToPrevMonth}
            onNext={goToNextMonth}
            onOpenWalkthrough={onOpenWalkthrough}
            walkthroughLoading={walkthroughLoading}
          />

          {/* Full-width desktop canvas */}
          <div className="w-full px-6 lg:px-10 py-5">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <MonthGrid
                currentMonth={currentMonth}
                sessionsByDate={sessionsByDate}
                completedSessions={completed}
                stravaByDate={stravaByDate}
                onSessionClick={handleSessionClick}
                onStravaActivityClick={handleStravaActivityClick}
                onSessionAdded={handleSessionAdded}
              />
            </DndContext>
          </div>
        </>
      )}

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        completedSessions={completed}
        onCompletedUpdate={(updatedList) => setCompleted(updatedList)}
      />

      <StravaActivityModal
        activity={selectedActivity}
        open={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        timezone={timezone}
      />
    </main>
  );
}
