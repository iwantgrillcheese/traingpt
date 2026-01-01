'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
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
  stravaActivities: StravaActivity[]; // intentionally not used for day rendering
  extraStravaActivities: StravaActivity[];
  onCompletedUpdate?: (updated: CompletedSession[]) => void;
  timezone?: string;
};

class NoopSensor {
  static activators: any[] = [];
  constructor() {}
}

function Toolbar({
  currentMonth,
  onPrev,
  onNext,
}: {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onPrev}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              onClick={onNext}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              aria-label="Next month"
            >
              →
            </button>

            <div className="ml-2">
              <div className="text-sm font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <div className="text-xs text-gray-500">Drag & drop to reschedule</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Placeholders for future: week/month toggle, filters, etc. */}
            <button className="hidden sm:inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50">
              Options
            </button>
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
}: CalendarShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
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

    // Make session order deterministic within a day
    Object.keys(map).forEach((k) => {
      map[k] = map[k].slice().sort((a, b) => {
        const as = (a.sport || '').toString();
        const bs = (b.sport || '').toString();
        return as.localeCompare(bs);
      });
    });

    return map;
  }, [localSessions]);

  const stravaByDate: Record<string, StravaActivity[]> = useMemo(() => {
    return normalizeStravaActivities(extraStravaActivities, timezone);
  }, [extraStravaActivities, timezone]);

  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const handleSessionClick = (session: MergedSession) => setSelectedSession(session);

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

  if (!hasMounted) return <main className="min-h-[100dvh] bg-white" />;

  return (
    <main className="min-h-[100dvh] w-full bg-white">
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
          <Toolbar currentMonth={currentMonth} onPrev={goToPrevMonth} onNext={goToNextMonth} />

          {/* Full-width desktop canvas */}
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <MonthGrid
                currentMonth={currentMonth}
                sessionsByDate={sessionsByDate}
                completedSessions={completed}
                stravaByDate={stravaByDate}
                onSessionClick={handleSessionClick}
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
    </main>
  );
}
