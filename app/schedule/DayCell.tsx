'use client';

import { useMemo } from 'react';
import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import type { CompletedSession } from '@/types/session';
import { conciseSessionLabel, getCompletionStatus } from './session-utils';

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

type SportKey = 'swim' | 'bike' | 'run' | 'strength' | 'rest' | 'other';

function normalizeSport(value?: string | null): SportKey {
  const v = String(value ?? '').toLowerCase();
  if (v.includes('swim')) return 'swim';
  if (v.includes('bike') || v.includes('ride') || v.includes('cycle')) return 'bike';
  if (v.includes('run')) return 'run';
  if (v.includes('strength') || v.includes('gym')) return 'strength';
  if (v.includes('rest') || v.includes('off')) return 'rest';
  return 'other';
}

function inferSportFromTitle(title?: string | null): SportKey {
  return normalizeSport(title);
}

function cleanTitle(title?: string | null) {
  return String(title ?? 'Untitled')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatDurationMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)}m`;
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatActivityDuration(seconds?: number | null) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatDurationMinutes(seconds / 60);
}

function formatDistanceMeters(meters?: number | null) {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) return null;
  if (meters >= 1609) return `${(meters / 1609.34).toFixed(1)} mi`;
  return `${Math.round(meters)} m`;
}

function sportStyles(sport: SportKey) {
  switch (sport) {
    case 'swim':
      return {
        dot: 'bg-blue-500',
        card: 'border-blue-200 bg-blue-50/70 hover:border-blue-300',
        label: 'text-blue-700',
      };
    case 'bike':
      return {
        dot: 'bg-emerald-500',
        card: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300',
        label: 'text-emerald-700',
      };
    case 'run':
      return {
        dot: 'bg-orange-500',
        card: 'border-orange-200 bg-orange-50/70 hover:border-orange-300',
        label: 'text-orange-700',
      };
    case 'strength':
      return {
        dot: 'bg-violet-500',
        card: 'border-violet-200 bg-violet-50/70 hover:border-violet-300',
        label: 'text-violet-700',
      };
    case 'rest':
      return {
        dot: 'bg-zinc-300',
        card: 'border-zinc-200 bg-white hover:border-zinc-300',
        label: 'text-zinc-500',
      };
    default:
      return {
        dot: 'bg-zinc-400',
        card: 'border-zinc-200 bg-white hover:border-zinc-300',
        label: 'text-zinc-600',
      };
  }
}

function DraggableSession({ session, children }: { session: MergedSession; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: session.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.75 : 1,
      }}
      className={clsx('touch-none', isDragging && 'relative z-20')}
    >
      {children}
    </div>
  );
}

function SessionCard({
  session,
  completedSessions,
  onClick,
}: {
  session: MergedSession;
  completedSessions: CompletedSession[];
  onClick?: (session: MergedSession) => void;
}) {
  const title = cleanTitle(session.title);
  const sport = normalizeSport(session.sport) || inferSportFromTitle(title);
  const styles = sportStyles(sport);
  const status = getCompletionStatus(
    { date: session.date, title: session.title, stravaActivity: session.stravaActivity },
    completedSessions
  );
  const completed = Boolean(session.stravaActivity) || status === 'done';
  const skipped = !session.stravaActivity && status === 'skipped';
  const duration = session.stravaActivity
    ? formatActivityDuration(session.stravaActivity.moving_time)
    : formatDurationMinutes(session.duration ?? null);
  const distance = session.stravaActivity ? formatDistanceMeters(session.stravaActivity.distance) : null;
  const isRest = sport === 'rest' || title.toLowerCase().includes('rest day');

  return (
    <DraggableSession session={session}>
      <button
        type="button"
        onClick={() => !isRest && onClick?.(session)}
        className={clsx(
          'group w-full rounded-xl border px-3 py-2 text-left transition-all',
          'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
          styles.card,
          skipped && 'opacity-60 grayscale',
          isRest && 'cursor-default bg-zinc-50/70'
        )}
        title={session.title}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <span className={clsx('h-1.5 w-1.5 rounded-full', styles.dot)} />
              <span className={clsx('text-[10px] font-semibold uppercase tracking-[0.12em]', styles.label)}>
                {sport}
              </span>
            </div>
            <div className="line-clamp-2 text-[12px] font-semibold leading-snug text-zinc-950">
              {isRest ? 'Rest day' : conciseSessionLabel(title, sport)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
              {duration ? <span>{duration}</span> : null}
              {distance ? <span>{distance}</span> : null}
              {session.stravaActivity ? <span className="font-medium text-orange-600">Strava</span> : null}
            </div>
          </div>

          <div className="shrink-0 text-[11px] font-semibold">
            {completed ? <span className="text-emerald-700">✓</span> : null}
            {skipped ? <span className="text-zinc-500">Skipped</span> : null}
          </div>
        </div>
      </button>
    </DraggableSession>
  );
}

function StravaImportCard({ activity, onClick }: { activity: StravaActivity; onClick?: (activity: StravaActivity) => void }) {
  const sport = normalizeSport(activity.sport_type);
  const styles = sportStyles(sport);
  const duration = formatActivityDuration(activity.moving_time);
  const distance = formatDistanceMeters(activity.distance);

  return (
    <button
      type="button"
      onClick={() => onClick?.(activity)}
      className="w-full rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-orange-300"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">Strava import</span>
      </div>
      <div className="line-clamp-1 text-[12px] font-semibold text-zinc-950">{activity.name || sport}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
        {duration ? <span>{duration}</span> : null}
        {distance ? <span>{distance}</span> : null}
      </div>
    </button>
  );
}

export default function DayCell({
  date,
  sessions,
  isOutside,
  onSessionClick,
  onStravaActivityClick,
  onAddSessionClick,
  completedSessions,
  extraActivities = [],
}: Props) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const today = isToday(date);

  const dayLabel = useMemo(
    () => ({ day: format(date, 'd'), weekday: format(date, 'EEE') }),
    [date]
  );

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex min-h-[176px] flex-col border-r border-b border-zinc-200/80 bg-white px-2.5 py-2.5 transition-colors',
        isOutside && 'bg-zinc-50/70 text-zinc-400',
        today && 'bg-blue-50/30',
        isOver && 'bg-zinc-100'
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className={clsx(
              'flex h-6 min-w-6 items-center justify-center rounded-full text-[13px] font-semibold',
              today ? 'bg-zinc-950 text-white' : isOutside ? 'text-zinc-400' : 'text-zinc-950'
            )}
          >
            {dayLabel.day}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {dayLabel.weekday}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            completedSessions={completedSessions}
            onClick={onSessionClick}
          />
        ))}

        {extraActivities.slice(0, 3).map((activity) => (
          <StravaImportCard
            key={String(activity.strava_id ?? activity.id)}
            activity={activity}
            onClick={onStravaActivityClick}
          />
        ))}

        <button
          type="button"
          onClick={() => onAddSessionClick?.(date)}
          className="mt-auto rounded-lg border border-dashed border-zinc-200 bg-white/70 px-2.5 py-2 text-center text-[12px] font-medium text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700"
        >
          + Add session
        </button>
      </div>
    </div>
  );
}
