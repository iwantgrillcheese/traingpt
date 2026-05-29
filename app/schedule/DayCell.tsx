'use client';

import { useMemo } from 'react';
import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import type { CompletedSession } from '@/types/session';

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

function cleanTitle(title?: string | null) {
  return String(title ?? 'Untitled')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/^[\s—–-]+/, '')
    .replace(/^[\s:•·]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function conciseTitle(title: string, sport: SportKey) {
  const cleaned = cleanTitle(title);
  const sportLabel = sport === 'bike' ? /^(bike|ride)[:\s—-]/i : new RegExp(`^${sport}[:\\s—-]`, 'i');
  return cleaned.replace(sportLabel, '').trim() || cleaned;
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

function getCompletionStatus(session: MergedSession, completedSessions: CompletedSession[]) {
  const match = completedSessions.find((item) => item.date === session.date && item.session_title === session.title);
  if (!match) return null;
  return match.status === 'skipped' ? 'skipped' : 'done';
}

function sportDotClass(sport: SportKey) {
  switch (sport) {
    case 'swim':
      return 'bg-sky-500';
    case 'bike':
      return 'bg-emerald-500';
    case 'run':
      return 'bg-orange-500';
    case 'strength':
      return 'bg-violet-500';
    case 'rest':
      return 'bg-zinc-300';
    default:
      return 'bg-zinc-400';
  }
}

function sportAccentClass(sport: SportKey) {
  switch (sport) {
    case 'swim':
      return 'border-l-sky-400';
    case 'bike':
      return 'border-l-emerald-500';
    case 'run':
      return 'border-l-orange-500';
    case 'strength':
      return 'border-l-violet-500';
    default:
      return 'border-l-zinc-300';
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
        opacity: isDragging ? 0.72 : 1,
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
  const sport = normalizeSport(session.sport || title);
  const status = getCompletionStatus(session, completedSessions);
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
          'group w-full rounded-lg border border-zinc-200 border-l-[3px] bg-white px-2.5 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50',
          sportAccentClass(sport),
          skipped && 'opacity-50',
          isRest && 'cursor-default border-l-zinc-200 bg-zinc-50/70'
        )}
        title={session.title}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <span className={clsx('h-1.5 w-1.5 rounded-full', sportDotClass(sport))} />
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">{sport}</span>
            </div>
            <div className="line-clamp-2 text-[12px] font-semibold leading-snug text-zinc-950">
              {isRest ? 'Rest day' : conciseTitle(title, sport)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
              {duration ? <span>{duration}</span> : null}
              {distance ? <span>{distance}</span> : null}
              {session.stravaActivity ? <span className="text-zinc-700">Strava</span> : null}
            </div>
          </div>

          <div className="shrink-0 text-[11px] font-semibold text-zinc-500">
            {completed ? <span>✓</span> : null}
            {skipped ? <span>Skip</span> : null}
          </div>
        </div>
      </button>
    </DraggableSession>
  );
}

function StravaImportCard({ activity, onClick }: { activity: StravaActivity; onClick?: (activity: StravaActivity) => void }) {
  const sport = normalizeSport(activity.sport_type);
  const duration = formatActivityDuration(activity.moving_time);
  const distance = formatDistanceMeters(activity.distance);

  return (
    <button
      type="button"
      onClick={() => onClick?.(activity)}
      className="w-full rounded-lg border border-zinc-200 border-l-[3px] border-l-orange-500 bg-white px-2.5 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">Strava</span>
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
        'group flex min-h-[150px] flex-col border-r border-b border-zinc-200 bg-white px-2 py-2 transition-colors',
        isOutside && 'bg-zinc-50 text-zinc-400',
        today && 'bg-zinc-50/80',
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
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
            {dayLabel.weekday}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
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
          className="mt-auto rounded-md border border-dashed border-zinc-200 bg-white/60 px-2 py-1.5 text-center text-[11px] font-medium text-zinc-400 opacity-70 transition hover:border-zinc-300 hover:text-zinc-700 group-hover:opacity-100"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
