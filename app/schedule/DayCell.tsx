'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, isToday } from 'date-fns';
import clsx from 'clsx';
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
  onStravaActivityClick?: (activity: StravaActivity) => void;
  completedSessions: CompletedSession[];
  extraActivities?: StravaActivity[];
  onSessionAdded?: (session: any) => void;
};

/* ---------- helpers ---------- */

function normalizeSportFromTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('swim')) return 'swim';
  if (lower.includes('bike') || lower.includes('ride')) return 'bike';
  if (lower.includes('run')) return 'run';
  if (lower.includes('rest')) return 'rest';
  if (lower.includes('strength')) return 'strength';
  return 'other';
}

function normalizeSport(sport: string): string {
  const lower = (sport || '').toLowerCase();
  if (lower === 'ride' || lower === 'virtualride' || lower === 'ebikeride') return 'bike';
  if (['bike', 'run', 'swim', 'strength', 'rest'].includes(lower)) return lower;
  return lower || 'other';
}

function sportAccentClass(sport: string) {
  switch (sport) {
    case 'swim':
      return { strip: 'bg-sky-500', soft: 'bg-sky-50' };
    case 'bike':
      return { strip: 'bg-amber-400', soft: 'bg-amber-50' };
    case 'run':
      return { strip: 'bg-emerald-500', soft: 'bg-emerald-50' };
    case 'strength':
      return { strip: 'bg-purple-500', soft: 'bg-purple-50' };
    case 'rest':
      return { strip: 'bg-zinc-500', soft: 'bg-zinc-50' };
    default:
      return { strip: 'bg-zinc-400', soft: 'bg-zinc-50' };
  }
}

function sportLabel(sport: string) {
  switch (sport) {
    case 'swim':
      return 'Swim';
    case 'bike':
      return 'Bike';
    case 'run':
      return 'Run';
    case 'strength':
      return 'Strength';
    case 'rest':
      return 'Rest';
    default:
      return 'Session';
  }
}

function stripLeadingEmoji(text: string) {
  return text.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '');
}

function formatDistanceMiles(distance?: number | null) {
  if (!distance) return null;
  return `${(distance / 1609.34).toFixed(1)} mi`;
}

function formatDuration(movingTime?: number | null) {
  if (!movingTime) return null;
  const h = Math.floor(movingTime / 3600);
  const m = Math.round((movingTime % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/* ---------- draggable wrapper ---------- */

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
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

/* ---------- main component ---------- */

export default function DayCell({
  date,
  sessions,
  isOutside,
  onSessionClick,
  onStravaActivityClick,
  completedSessions,
  extraActivities = [],
  onSessionAdded,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const dateStr = format(date, 'yyyy-MM-dd');

  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const [justDropped, setJustDropped] = useState(false);

  useEffect(() => {
    if (!isOver) return;
    setJustDropped(true);
    const timer = setTimeout(() => setJustDropped(false), 450);
    return () => clearTimeout(timer);
  }, [isOver]);

  const isSessionCompleted = (session: MergedSession) =>
    completedSessions?.some((c) => c.date === session.date && c.session_title === session.title);

  const header = useMemo(() => {
    const dayNum = format(date, 'd');
    const dayWk = format(date, 'EEE');
    return { dayNum, dayWk };
  }, [date]);

  return (
    <>
      <div
        ref={setNodeRef}
        className={clsx(
          'h-full w-full px-3 py-3',
          isOutside && 'opacity-60',
          isOver && 'bg-gray-50',
          justDropped && 'animate-pulse'
        )}
      >
        {/* Day header */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div className={clsx('text-sm font-semibold', isOutside ? 'text-gray-400' : 'text-gray-900')}>
              {header.dayNum}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {header.dayWk}
            </div>
          </div>

          {isToday(date) ? (
            <div className="text-[11px] font-medium text-gray-700 rounded-full border border-gray-200 bg-white px-2 py-0.5">
              Today
            </div>
          ) : null}
        </div>

        {/* Sessions stack */}
        <div className="mt-2 flex flex-col gap-1.5">
          {sessions?.map((s) => {
            const rawTitle = s.title ?? '';
            const isRest = rawTitle.toLowerCase().includes('rest day');

            const sportRaw = String(s.sport ?? normalizeSportFromTitle(rawTitle));
            const sport = normalizeSport(sportRaw);

            const isStravaMatch = !!s.stravaActivity;
            const isCompleted = isSessionCompleted(s) || isStravaMatch;

            const [labelLine, ...rest] = rawTitle.split(': ');
            const detailLine = rest.join(': ').trim();

            const baseTitle = stripLeadingEmoji(labelLine?.trim() || 'Untitled');
            const titleLine = isRest ? 'Rest Day' : baseTitle || 'Untitled';

            const accent = sportAccentClass(sport);
            const activity = s.stravaActivity;
            const duration = formatDuration(activity?.moving_time ?? null);
            const distance = formatDistanceMiles(activity?.distance ?? null);

            return (
              <DraggableSession key={s.id} session={s}>
                <button
                  onClick={() => !isRest && onSessionClick?.(s)}
                  className={clsx(
                    'w-full text-left border transition',
                    'rounded-md overflow-hidden',
                    'hover:border-gray-400 hover:bg-gray-50/40',
                    isStravaMatch
                      ? 'border-indigo-200 bg-indigo-50/30'
                      : isCompleted
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-gray-200 bg-white'
                  )}
                  title={rawTitle}
                >
                  {/* TP-like header strip */}
                  <div className={clsx('h-5 px-2 flex items-center justify-between', accent.strip)}>
                    <span className="text-[10px] font-semibold text-white/95">
                      {sportLabel(sport)}
                    </span>

                    {isStravaMatch ? (
                      <span className="text-[10px] font-semibold text-white/95">Strava</span>
                    ) : null}
                  </div>

                  {/* Body */}
                  <div className="px-2 py-2">
                    <div className="text-[12px] font-semibold text-gray-900 leading-4 line-clamp-2">
                      {titleLine}
                    </div>

                    {detailLine ? (
                      <div className="mt-1 text-[11px] leading-4 text-gray-600 line-clamp-2">
                        {detailLine}
                      </div>
                    ) : null}

                    {/* Optional tiny footer meta (only when Strava matched) */}
                    {isStravaMatch ? (
                      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                        <span>{duration ?? '—'}</span>
                        <span>{distance ?? '—'}</span>
                      </div>
                    ) : null}
                  </div>
                </button>
              </DraggableSession>
            );
          })}

          {/* Strava-only extras (unmatched only) */}
          {extraActivities?.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {extraActivities.map((a) => {
                const sport = normalizeSport((a.sport_type || '').toLowerCase());
                const accent = sportAccentClass(sport);

                const duration = formatDuration(a.moving_time ?? null);
                const distance = formatDistanceMiles(a.distance ?? null);

                const key = String((a as any).strava_id ?? (a as any).id);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onStravaActivityClick?.(a)}
                    className={clsx(
                      'w-full text-left border transition',
                      'rounded-md overflow-hidden',
                      'hover:border-gray-400 hover:bg-gray-50/40',
                      'border-indigo-200 bg-indigo-50/30'
                    )}
                    title={a.name || 'Strava activity'}
                  >
                    <div className={clsx('h-5 px-2 flex items-center justify-between', accent.strip)}>
                      <span className="text-[10px] font-semibold text-white/95">
                        {sportLabel(sport)}
                      </span>
                      <span className="text-[10px] font-semibold text-white/95">Strava</span>
                    </div>

                    <div className="px-2 py-2">
                      <div className="text-[12px] font-semibold text-gray-900 leading-4 line-clamp-2">
                        {a.name || 'Unplanned Activity'}
                      </div>
                      <div className="mt-1 text-[11px] leading-4 text-gray-600 line-clamp-1">
                        Strava activity (not in plan)
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                        <span>{duration ?? '—'}</span>
                        <span>{distance ?? '—'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Add session */}
          <button
            onClick={() => setShowForm(true)}
            className={clsx(
              'mt-1 inline-flex items-center justify-center rounded-md border border-dashed',
              'border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:text-gray-900',
              'hover:bg-gray-50 transition'
            )}
          >
            + Add session
          </button>
        </div>
      </div>

      {/* Form modal */}
      <div
        className={clsx(
          'fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200',
          showForm ? 'opacity-100 visible bg-black/20 backdrop-blur-sm' : 'opacity-0 invisible'
        )}
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl border border-gray-200">
          <InlineSessionForm
            date={format(date, 'yyyy-MM-dd')}
            onClose={() => setShowForm(false)}
            onAdded={(newSession: any) => {
              onSessionAdded?.(newSession);
              setShowForm(false);
            }}
          />
        </div>
      </div>
    </>
  );
}
