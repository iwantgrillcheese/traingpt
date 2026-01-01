'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import DesktopContextPanel from './DesktopContextPanel';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
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
};

function SupportBanner() {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  return (
    <button
      onClick={handleClick}
      className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 transition"
    >
      <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400" />
      <span className="text-gray-600 underline hover:text-gray-800">
        Support the project ($5/month)
      </span>
    </button>
  );
}

/**
 * A sensor that never activates. Used to avoid mounting TouchSensor on mobile,
 * which can swallow taps / interfere with navigation.
 */
class NoopSensor {
  static activators: any[] = [];
  constructor() {}
}

export default function CalendarShell({
  sessions,
  completedSessions,
  stravaActivities, // intentionally NOT used for day rendering
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

  // ✅ IMPORTANT: only mount real DnD sensors on desktop
  // Mobile uses NoopSensor to avoid TouchSensor swallowing taps.
  const sensors = useSensors(
    useSensor(isMobile ? (NoopSensor as any) : MouseSensor, {
      activationConstraint: { distance: 8 },
    } as SensorOptions),
    useSensor(isMobile ? (NoopSensor as any) : TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    } as SensorOptions)
  );

  const handleSessionAdded = (newSession: any) => {
    setLocalSessions((prev) => [...prev, newSession]);
  };

  const sessionsByDate = useMemo(() => {
    const map: Record<string, MergedSession[]> = {};
    localSessions.forEach((s) => {
      if (!s.date) return;
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [localSessions]);

  const stravaByDate: Record<string, StravaActivity[]> = useMemo(() => {
    return normalizeStravaActivities(extraStravaActivities, timezone);
  }, [extraStravaActivities, timezone]);

  const handleSessionClick = (session: MergedSession) => setSelectedSession(session);
  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

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
    }, 600);
  };

  if (!hasMounted) {
    return <main className="min-h-[100dvh] bg-background" />;
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      {isMobile ? (
        <div className="px-0">
          <MobileCalendarView
            sessions={localSessions as any}
            completedSessions={completed}
            stravaActivities={extraStravaActivities}
          />
        </div>
      ) : (
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-8 lg:px-10">
          <SupportBanner />

          {/* Desktop “mission control” shell */}
          <div className="grid grid-cols-[320px_1fr] gap-6 items-start">
            <DesktopContextPanel
              currentMonth={currentMonth}
              localSessions={localSessions}
              completedSessions={completed}
            />

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevMonth}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  ←
                </button>

                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h2>
                  <div className="mt-0.5 text-xs text-gray-500">
                    Drag and drop sessions to reschedule
                  </div>
                </div>

                <button
                  onClick={goToNextMonth}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  →
                </button>
              </div>

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
            </section>
          </div>
        </div>
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
