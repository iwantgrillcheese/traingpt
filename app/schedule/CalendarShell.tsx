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
  stravaActivities: StravaActivity[];
  extraStravaActivities: StravaActivity[];
  onCompletedUpdate?: (updated: CompletedSession[]) => void;
  timezone?: string;

  onOpenWalkthrough?: () => void;
  walkthroughLoading?: boolean;
};

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
  onToday,
  onOpenWalkthrough,
  walkthroughLoading,
}: {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenWalkthrough?: () => void;
  walkthroughLoading?: boolean;
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-black/10 bg-white">
      <div className="w-full px-6 lg:px-10">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-[15px] font-semibold tracking-tight text-zinc-950">
              {format(currentMonth, 'MMMM yyyy')}
            </div>

            <div className="h-5 w-px bg-black/10" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToday}
                className="h-9 rounded-md border border-black/10 bg-white px-3 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Today
              </button>

              <button
                type="button"
                onClick={onPrev}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-zinc-700 hover:bg-zinc-50"
                aria-label="Previous month"
              >
                <IconChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-zinc-700 hover:bg-zinc-50"
                aria-label="Next month"
              >
                <IconChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenWalkthrough ? (
              <button
                type="button"
                onClick={onOpenWalkthrough}
                disabled={walkthroughLoading}
                className="h-9 rounded-md border border-black/10 bg-white px-3 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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
  const [hasMounted, setHasMounted] = useState(false);

  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  const [completed, setCompleted] = useState<CompletedSession[]>(completedSessions);
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setHasMounted(true), []);
  useEffect(() => setCompleted(completedSessions), [completedSessions]);
  useEffect(() => setLocalSessions(sessions), [sessions]);

  useEffect(() => {
    onCompletedUpdate?.(completed);
  }, [completed, onCompletedUpdate]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    } as SensorOptions),
    useSensor(TouchSensor, {
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
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()));

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
      const { error } = await supabase.from('sessions').update({ date: targetDate }).eq('id', draggedId);
      if (error) console.error('Error persisting session move:', error);
    }, 450);
  };

  if (!hasMounted) return <main className="min-h-[100dvh] w-full bg-white" />;

  return (
    <main className="min-h-[100dvh] w-full bg-zinc-50 pb-[env(safe-area-inset-bottom)]">
      {/* Mobile (CSS-controlled) */}
      <div className="md:hidden">
        <MobileCalendarView
          sessions={localSessions as any}
          completedSessions={completed}
          stravaActivities={extraStravaActivities}
        />
      </div>

      {/* Desktop (CSS-controlled) */}
      <div className="hidden md:block md:h-[100dvh] md:overflow-y-auto">
        <Toolbar
          currentMonth={currentMonth}
          onPrev={goToPrevMonth}
          onNext={goToNextMonth}
          onToday={goToToday}
          onOpenWalkthrough={onOpenWalkthrough}
          walkthroughLoading={walkthroughLoading}
        />

        {/* Full-width canvas */}
        <div className="w-full px-6 py-5 lg:px-10">
          <div className="w-full overflow-x-auto">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <MonthGrid
                currentMonth={currentMonth}
                sessionsByDate={sessionsByDate}
                completedSessions={completed}
                stravaByDate={stravaByDate}
                onSessionClick={(s) => setSelectedSession(s)}
                onStravaActivityClick={(a) => setSelectedActivity(a)}
                onSessionAdded={handleSessionAdded}
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
