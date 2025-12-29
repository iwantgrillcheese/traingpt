'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { startOfMonth, subMonths, addMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import MobileCalendarView from './MobileCalendarView';
import SessionModal from './SessionModal';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase-client';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

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

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } });
  const sensors = useSensors(mouseSensor, touchSensor);

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
      const { error } = await supabase.from('sessions').update({ date: targetDate }).eq('id', draggedId);
      if (error) console.error('Error persisting session move:', error);
    }, 600);
  };

  if (!hasMounted) {
    return <main className="min-h-[100dvh] bg-background" />;
  }

  return (
    <main
      className={
        `min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)] ` +
        (isMobile
          ? 'px-0'
          : 'px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 max-w-[1800px] mx-auto')
      }
    >
      {isMobile ? (
        <MobileCalendarView
          sessions={localSessions as any}
          completedSessions={completed}
          // ✅ IMPORTANT: pass a stable prop so MobileCalendarView doesn't default to [] each render
          stravaActivities={extraStravaActivities}
        />
      ) : (
        <>
          <SupportBanner />

          <div className="flex items-center justify-between mb-6 w-full">
            <button onClick={goToPrevMonth} className="text-sm text-gray-500 hover:text-black">
              ←
            </button>
            <h2 className="text-2xl font-semibold text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={goToNextMonth} className="text-sm text-gray-500 hover:text-black">
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
