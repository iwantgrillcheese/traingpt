'use client';

import { format, isToday } from 'date-fns';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import CalendarWorkoutCard from './CalendarWorkoutCard';
import { isRestSession } from './calendar-utils';

type Props = {
  date: Date;
  sessions: MergedSession[];
  isOutside: boolean;
  completedSessions: CompletedSession[];
  extraActivities?: StravaActivity[];
  onSessionClick?: (session: MergedSession) => void;
  onStravaActivityClick?: (activity: StravaActivity) => void;
  onAddSessionClick?: (date: Date) => void;
};

function DraggableWorkout({ session, completedSessions, onClick }: { session: MergedSession; completedSessions: CompletedSession[]; onClick: () => void }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: session.id, disabled: isRestSession(session) });
  return (
    <div ref={setNodeRef} {...listeners} className={isDragging ? 'relative z-20 touch-none' : 'touch-none'} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.72 : 1 }}>
      <CalendarWorkoutCard session={session} completedSessions={completedSessions} onClick={onClick} />
    </div>
  );
}

export default function DayCell({ date, sessions, isOutside, completedSessions, extraActivities = [], onSessionClick, onStravaActivityClick, onAddSessionClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: format(date, 'yyyy-MM-dd') });
  const today = isToday(date);
  return (
    <div ref={setNodeRef} aria-label={format(date, 'EEEE, MMMM d')} className={`group flex min-h-[150px] min-w-0 flex-col border-b border-r border-[#E3E0D8] p-2.5 ${isOver ? 'bg-[#E9ECE8]' : isOutside ? 'bg-[#F7F6F2]' : 'bg-white'}`}>
      <div className="mb-3 flex items-center justify-between">
        <time dateTime={format(date, 'yyyy-MM-dd')} aria-current={today ? 'date' : undefined} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${today ? 'bg-[#101114] text-white' : isOutside ? 'text-[#9CA3AF]' : 'text-[#101114]'}`}>{format(date, 'd')}</time>
        <button type="button" aria-label={`Add session on ${format(date, 'MMMM d')}`} onClick={() => onAddSessionClick?.(date)} className="rounded-lg px-2 py-1 text-sm text-[#6B7280] opacity-0 hover:bg-[#F7F6F2] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100">+</button>
      </div>
      <div className="space-y-2">
        {sessions.map(session => <DraggableWorkout key={session.id} session={session} completedSessions={completedSessions} onClick={() => onSessionClick?.(session)} />)}
        {extraActivities.map(activity => <CalendarWorkoutCard key={`strava-${activity.strava_id ?? activity.id}`} activity={activity} completedSessions={completedSessions} onClick={() => onStravaActivityClick?.(activity)} />)}
      </div>
    </div>
  );
}
