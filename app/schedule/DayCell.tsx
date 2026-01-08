'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';
import AddSessionModalTP from './AddSessionModalTP';


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

/**
 * Premium palette: neutral surface + ink accents (no pastels).
 * Goal: feel like Strava Pro / Intervals — color is identity, not decoration.
 */
function sportAccent(sport: string) {
  switch (sport) {
    case 'swim':
      return {
        rail: 'bg-slate-700/80',
        ring: 'ring-slate-900/10',
        badge: 'text-slate-700',
      };
    case 'bike':
      return {
        rail: 'bg-zinc-900/70',
        ring: 'ring-zinc-900/10',
        badge: 'text-zinc-700',
      };
    case 'run':
      return {
        rail: 'bg-emerald-800/75',
        ring: 'ring-emerald-900/10',
        badge: 'text-emerald-800',
      };
    case 'strength':
      return {
        rail: 'bg-violet-800/70',
        ring: 'ring-violet-900/10',
        badge: 'text-violet-800',
      };
    case 'rest':
      return {
        rail: 'bg-zinc-500/60',
        ring: 'ring-zinc-900/5',
        badge: 'text-zinc-600',
      };
    default:
      return {
        rail: 'bg-zinc-600/55',
        ring: 'ring-zinc-900/5',
        badge: 'text-zinc-700',
      };
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
        opacity: isDragging ? 0.75 : 1,
      }}
      className={clsx('cursor-grab active:cursor-grabbing', isDragging && 'z-10')}
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

  const dayIsToday = isToday(date);

  return (
    <>
      <div
        ref={setNodeRef}
        className={clsx(
          'h-full w-full px-3 py-3',
          'transition-colors',
          isOutside && 'opacity-60',
          isOver && 'bg-black/[0.02]',
          justDropped && 'animate-pulse'
        )}
      >
        {/* Day header */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div
              className={clsx(
                'text-sm font-semibold tracking-tight',
                isOutside ? 'text-zinc-400' : 'text-zinc-950'
              )}
            >
              {header.dayNum}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {header.dayWk}
            </div>
          </div>

          {dayIsToday ? (
            <div className="text-[11px] font-medium text-zinc-700 rounded-full border border-black/10 bg-white/70 backdrop-blur px-2 py-0.5">
              Today
            </div>
          ) : null}
        </div>

        {/* Sessions stack */}
        <div className="mt-2 flex flex-col gap-2">
          {sessions?.map((s) => {
            const rawTitle = s.title ?? '';
            const isRest =
              rawTitle.toLowerCase().includes('rest day') ||
              normalizeSport(String(s.sport ?? '')).toLowerCase() === 'rest';

            const sportRaw = String(s.sport ?? normalizeSportFromTitle(rawTitle));
            const sport = normalizeSport(sportRaw);

            const isStravaMatch = !!s.stravaActivity;
            const isCompleted = isSessionCompleted(s) || isStravaMatch;

            // Improve readability: keep title intact; treat everything after ": " as details if present
            const [labelLine, ...rest] = rawTitle.split(': ');
            const detailLine = rest.join(': ').trim();

            const baseTitle = stripLeadingEmoji((labelLine || rawTitle).trim() || 'Untitled');
            const titleLine = isRest ? 'Rest Day' : baseTitle || 'Untitled';

            const accent = sportAccent(sport);

            const activity = s.stravaActivity;
            const duration = formatDuration(activity?.moving_time ?? null);
            const distance = formatDistanceMiles(activity?.distance ?? null);

            return (
              <DraggableSession key={s.id} session={s}>
                <button
                  onClick={() => !isRest && onSessionClick?.(s)}
                  className={clsx(
                    'w-full text-left overflow-hidden rounded-lg border transition-all',
                    'border-black/5 bg-white',
                    'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
                    'hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:-translate-y-[1px]',
                    'active:translate-y-0',
                    // premium rings: subtle, derived from sport palette
                    (isStravaMatch || isCompleted) && 'ring-1',
                    (isStravaMatch || isCompleted) && accent.ring
                  )}
                  title={rawTitle}
                >
                  <div className="flex">
                    {/* Accent rail (final boss: thinner rail + slightly more padding in body) */}
                    <div className={clsx('w-1', accent.rail)} />

                    {/* Body */}
                    <div className="min-w-0 flex-1 px-3.5 py-2.5">
                      {/* Top meta row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-medium text-zinc-500">
                            {sportLabel(sport)}
                          </span>

                          {isStravaMatch ? (
                            <span className="shrink-0 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                              Strava
                            </span>
                          ) : null}

                          {!isStravaMatch && isCompleted ? (
                            <span className={clsx('shrink-0 text-[11px] font-semibold', accent.badge)}>
                              ✓
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="mt-1 text-[13.5px] font-semibold tracking-tight text-zinc-950 line-clamp-2 leading-snug">
                        {titleLine}
                      </div>

                      {/* Detail */}
                      {detailLine ? (
                        <div className="mt-1 text-[12px] leading-snug text-zinc-500 line-clamp-1">
                          {detailLine}
                        </div>
                      ) : null}

                      {/* Strava meta */}
                      {isStravaMatch ? (
                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{duration ?? '—'}</span>
                          <span>{distance ?? '—'}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              </DraggableSession>
            );
          })}

          {/* Strava-only extras (unmatched only) */}
          {extraActivities?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {extraActivities.map((a) => {
                const sport = normalizeSport((a.sport_type || '').toLowerCase());
                const accent = sportAccent(sport);

                const duration = formatDuration(a.moving_time ?? null);
                const distance = formatDistanceMiles(a.distance ?? null);

                const key = String((a as any).strava_id ?? (a as any).id);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onStravaActivityClick?.(a)}
                    className={clsx(
                      'w-full text-left overflow-hidden rounded-lg border transition-all',
                      'border-black/5 bg-white',
                      'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
                      'hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:-translate-y-[1px]',
                      // subtle ring so Strava-only doesn’t scream
                      'ring-1 ring-zinc-900/5'
                    )}
                    title={a.name || 'Strava activity'}
                  >
                    <div className="flex">
                      {/* Accent rail (final boss: thinner) */}
                      <div className={clsx('w-1', accent.rail)} />

                      {/* Body */}
                      <div className="min-w-0 flex-1 px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-zinc-500">
                            {sportLabel(sport)}
                          </span>
                          <span className="shrink-0 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                            Strava
                          </span>
                        </div>

                        <div className="mt-1 text-[13.5px] font-semibold tracking-tight text-zinc-950 line-clamp-2 leading-snug">
                          {a.name || 'Unplanned Activity'}
                        </div>

                        <div className="mt-1 text-[12px] leading-snug text-zinc-500 line-clamp-1">
                          Strava activity (not in plan)
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{duration ?? '—'}</span>
                          <span>{distance ?? '—'}</span>
                        </div>
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
              'mt-1 inline-flex items-center justify-center rounded-lg border border-dashed',
              'border-black/10 bg-white/60 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-700',
              'hover:bg-white transition'
            )}
          >
            + Add session
          </button>
        </div>
      </div>

      {/* Form modal */}
      <AddSessionModalTP
  open={showForm}
  date={date}
  onClose={() => setShowForm(false)}
  onAdded={(newSession: any) => {
    onSessionAdded?.(newSession);
    setShowForm(false);
  }}
/>

    </>
  );
}
