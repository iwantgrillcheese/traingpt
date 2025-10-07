'use client';

import { useState } from 'react';
import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import { getSessionColor } from '@/utils/session-utils';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import InlineSessionForm from './InlineSessionForm';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  date: Date;
  sessions: MergedSession[];
  isOutside: boolean;
  onSessionClick?: (session: MergedSession) => void;
  completedSessions: CompletedSession[];
  extraActivities?: StravaActivity[];
  onSessionAdded?: (session: any) => void;
};

function normalizeSport(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('swim')) return 'swim';
  if (lower.includes('bike')) return 'bike';
  if (lower.includes('run')) return 'run';
  if (lower.includes('rest')) return 'rest';
  if (lower.includes('strength')) return 'strength';
  return 'other';
}

function sportEmoji(sport: string): string {
  switch (sport.toLowerCase()) {
    case 'swim':
      return '🏊';
    case 'bike':
      return '🚴';
    case 'run':
      return '🏃';
    case 'strength':
      return '💪';
    default:
      return '🔸';
  }
}

function startsWithEmoji(text: string) {
  return /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u.test(text);
}

/** 🧩 Make each session draggable */
function DraggableSession({
  session,
  children,
}: {
  session: MergedSession;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

export default function DayCell({
  date,
  sessions,
  isOutside,
  onSessionClick,
  completedSessions,
  extraActivities = [],
  onSessionAdded,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const dateStr = format(date, 'yyyy-MM-dd');

  // Make this day droppable
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });

  const isSessionCompleted = (session: MergedSession) =>
    completedSessions.some(
      (c) => c.date === session.date && c.session_title === session.title
    );

  const [justDropped, setJustDropped] = useState(false);

  // Trigger a short visual pulse after a successful drop
  if (isOver && !justDropped) {
    setJustDropped(true);
    setTimeout(() => setJustDropped(false), 600);
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'min-h-[220px] p-3 border rounded-xl flex flex-col gap-2 transition-all duration-150 w-full',
        isOutside ? 'bg-zinc-100 text-zinc-400' : 'bg-white text-black',
        isToday(date) && 'ring-2 ring-blue-400',
        isOver && 'bg-blue-50 border-blue-300 shadow-inner',
        justDropped && 'animate-pulse bg-blue-100 border-blue-400'
      )}
    >

      {/* Date header */}
      <div className="text-xs text-zinc-500 font-medium text-right uppercase tracking-wide">
        {format(date, 'EEE d')}
      </div>

      {/* Session tiles */}
      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          const rawTitle = s.title ?? '';
          const isRest = rawTitle.toLowerCase().includes('rest day');
          const sport = s.sport || normalizeSport(rawTitle);
          const emoji = sportEmoji(sport);
          const colorClass = getSessionColor(isRest ? 'rest' : sport);

          const isStravaMatch = !!s.stravaActivity;
          const isCompleted = isSessionCompleted(s) || isStravaMatch;

          const [labelLine, ...rest] = rawTitle.split(':');
          const titleLine = isRest ? 'Rest Day' : labelLine?.trim() || 'Untitled';
          const detailLine = rest.join(':').trim();

          const activity = s.stravaActivity;
          const duration = activity?.moving_time
            ? `${Math.floor(activity.moving_time / 3600)}h ${Math.round(
                (activity.moving_time % 3600) / 60
              )}m`
            : null;
          const distance = activity?.distance
            ? `${(activity.distance / 1609).toFixed(1)} mi`
            : null;
          const hr = activity?.average_heartrate
            ? `${Math.round(activity.average_heartrate)} bpm`
            : null;
          const watts = activity?.average_watts
            ? `${Math.round(activity.average_watts)}w`
            : null;

          return (
            <DraggableSession key={s.id} session={s}>
              <button
                onClick={() => !isRest && onSessionClick?.(s)}
                className={clsx(
                  'w-full text-left rounded-md px-3 py-2 transition-all border hover:shadow-sm',
                  isStravaMatch
                    ? 'bg-blue-50 border-blue-300'
                    : isCompleted
                    ? 'bg-green-50 border-green-300'
                    : 'bg-muted/20 border-muted'
                )}
                title={rawTitle}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm leading-snug line-clamp-2">
                    {startsWithEmoji(titleLine) ? (
                      titleLine
                    ) : (
                      <>
                        <span className="mr-1">{emoji}</span>
                        {titleLine}
                      </>
                    )}
                  </div>
                  {isStravaMatch && (
                    <span className="text-xs text-blue-500">(Strava)</span>
                  )}
                  {!isStravaMatch && isCompleted && (
                    <span className="text-sm text-green-600">✓</span>
                  )}
                </div>

                {detailLine && (
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {detailLine}
                  </div>
                )}

                {isStravaMatch && (
                  <div className="mt-1 text-xs text-blue-700 flex flex-col gap-0.5">
                    <div className="flex justify-between w-full">
                      <span>{duration}</span>
                      <span>{distance}</span>
                    </div>
                    <div className="flex justify-between w-full">
                      <span>{hr}</span>
                      <span>{watts}</span>
                    </div>
                  </div>
                )}
              </button>
            </DraggableSession>
          );
        })}

        {/* Extra Strava-only activities */}
        {extraActivities.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {extraActivities.map((a) => {
              const duration = a.moving_time
                ? `${Math.floor(a.moving_time / 60)}m`
                : '';
              const distance = a.distance
                ? `${(a.distance / 1609).toFixed(1)} mi`
                : '';
              const hr = a.average_heartrate
                ? `${Math.round(a.average_heartrate)} bpm`
                : '';
              const watts = a.average_watts
                ? `${Math.round(a.average_watts)}w`
                : '';

              return (
                <div
                  key={a.id}
                  className="rounded-md bg-blue-50 border border-blue-300 px-3 py-2 text-xs text-blue-800"
                >
                  🚴 {a.name || 'Unplanned Activity'}
                  <div className="flex justify-between text-[11px]">
                    <span>{duration}</span>
                    <span>{distance}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>{hr}</span>
                    <span>{watts}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Session Button */}
        <button
          onClick={() => setShowForm(true)}
          className="text-gray-400 hover:text-black text-sm mt-1"
        >
          ＋ Add session
        </button>

        {showForm && (
          <InlineSessionForm
            date={format(date, 'yyyy-MM-dd')}
            onClose={() => setShowForm(false)}
            onAdded={(newSession: any) => {
              onSessionAdded?.(newSession);
              setShowForm(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
