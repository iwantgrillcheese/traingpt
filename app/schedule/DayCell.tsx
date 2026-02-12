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
  onSessionAdded?: (session: any) => void;
  completedSessions: CompletedSession[];
  extraActivities?: StravaActivity[];
};

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

function sportTheme(sport: string) {
  switch (sport) {
    case 'swim':
      return {
        rail: 'bg-slate-600',
        top: 'bg-slate-600',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        text: 'text-slate-700',
      };
    case 'bike':
      return {
        rail: 'bg-zinc-700',
        top: 'bg-zinc-700',
        badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        text: 'text-zinc-700',
      };
    case 'run':
      return {
        rail: 'bg-emerald-700',
        top: 'bg-emerald-700',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        text: 'text-emerald-700',
      };
    case 'strength':
      return {
        rail: 'bg-violet-700',
        top: 'bg-violet-700',
        badge: 'bg-violet-50 text-violet-700 border-violet-200',
        text: 'text-violet-700',
      };
    case 'rest':
      return {
        rail: 'bg-zinc-500',
        top: 'bg-zinc-500',
        badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        text: 'text-zinc-600',
      };
    default:
      return {
        rail: 'bg-zinc-600',
        top: 'bg-zinc-600',
        badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        text: 'text-zinc-700',
      };
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
        opacity: isDragging ? 0.85 : 1,
      }}
      className={clsx('cursor-grab active:cursor-grabbing', isDragging && 'z-10')}
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
  onStravaActivityClick,
  onSessionAdded,
  completedSessions,
  extraActivities = [],
}: Props) {
  const dateStr = format(date, 'yyyy-MM-dd');

  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const [justDropped, setJustDropped] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isOver) return;
    setJustDropped(true);
    const timer = setTimeout(() => setJustDropped(false), 350);
    return () => clearTimeout(timer);
  }, [isOver]);

  const completedSessionKeys = useMemo(() => {
    return new Set(completedSessions.map((c) => `${c.date}::${c.session_title}`));
  }, [completedSessions]);

  const isSessionCompleted = (session: MergedSession) =>
    completedSessionKeys.has(`${session.date}::${session.title}`);

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
          'h-full w-full px-2 py-2.5 transition-colors',
          isOutside && 'opacity-55',
          isOver && 'bg-black/[0.015]',
          justDropped && 'animate-pulse'
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div
              className={clsx(
                'text-[14px] font-semibold tracking-tight',
                isOutside ? 'text-zinc-400' : 'text-zinc-900'
              )}
            >
              {header.dayNum}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{header.dayWk}</div>
          </div>

          {dayIsToday ? <div className="h-1.5 w-1.5 rounded-full bg-zinc-900/50" /> : null}
        </div>

        <div className="flex flex-col gap-2">
          {sessions?.map((s) => {
            const rawTitle = s.title ?? '';
            const rawTitleLower = rawTitle.toLowerCase();

            const sportRaw = String(s.sport ?? normalizeSportFromTitle(rawTitle));
            const sport = normalizeSport(sportRaw);

            const isRest = rawTitleLower.includes('rest day') || sport === 'rest';
            const isStravaMatch = !!s.stravaActivity;
            const isCompleted = isSessionCompleted(s) || isStravaMatch;

            const [labelLine, ...rest] = rawTitle.split(': ');
            const detailLine = rest.join(': ').trim();

            const baseTitle = stripLeadingEmoji((labelLine || rawTitle).trim() || 'Untitled');
            const titleLine = isRest ? 'Rest Day' : baseTitle || 'Untitled';

            const theme = sportTheme(sport);

            const activity = s.stravaActivity;
            const duration = formatDuration(activity?.moving_time ?? null);
            const distance = formatDistanceMiles(activity?.distance ?? null);

            return (
              <DraggableSession key={s.id} session={s}>
                <button
                  onClick={() => !isRest && onSessionClick?.(s)}
                  className={clsx(
                    'w-full overflow-hidden rounded-lg border border-black/10 bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
                    'hover:border-black/20 hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] transition-all',
                    (isStravaMatch || isCompleted) && 'ring-1 ring-black/5'
                  )}
                  title={rawTitle}
                >
                  <div className={clsx('flex items-center justify-between border-b border-black/10 px-2.5 py-1 text-[11px] font-semibold text-white', theme.top)}>
                    <div className="flex items-center gap-1.5 text-white/95">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
                      <span>{isRest ? 'Rest' : sport.toUpperCase()}</span>
                    </div>
                    <div className="text-white/95">{duration ?? 'Planned'}</div>
                  </div>

                  <div className="flex">
                    <div className={clsx('w-[3px]', theme.rail)} />
                    <div className="min-w-0 flex-1 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-zinc-950">{titleLine}</div>
                          {detailLine ? (
                            <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-zinc-500">{detailLine}</div>
                          ) : null}
                        </div>

                        <div className="shrink-0 space-y-1 text-right">
                          {isStravaMatch ? (
                            <span className="inline-flex rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">Strava</span>
                          ) : null}
                          {!isStravaMatch && isCompleted ? (
                            <span className={clsx('inline-flex text-[11px] font-semibold', theme.text)}>✓ Done</span>
                          ) : null}
                        </div>
                      </div>

                      {distance ? <div className="mt-1 text-[10.5px] font-medium text-zinc-500">{distance}</div> : null}
                    </div>
                  </div>
                </button>
              </DraggableSession>
            );
          })}

          {extraActivities?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {extraActivities.map((a) => {
                const sport = normalizeSport((a.sport_type || '').toLowerCase());
                const theme = sportTheme(sport);
                const duration = formatDuration(a.moving_time ?? null);
                const distance = formatDistanceMiles(a.distance ?? null);
                const key = String((a as any).strava_id ?? (a as any).id);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onStravaActivityClick?.(a)}
                    className="w-full overflow-hidden rounded-lg border border-black/10 bg-white text-left ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:border-black/20"
                    title={a.name || 'Strava activity'}
                  >
                    <div className={clsx('border-b border-black/10 px-2.5 py-1 text-[11px] font-semibold text-white', theme.top)}>
                      Strava import
                    </div>
                    <div className="flex">
                      <div className={clsx('w-[3px]', theme.rail)} />
                      <div className="min-w-0 flex-1 px-2.5 py-2">
                        <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-zinc-950">
                          {a.name || 'Unplanned Activity'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500">{duration ?? '—'} {distance ? `• ${distance}` : ''}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          <button
            onClick={() => setShowForm(true)}
            className={clsx(
              'mt-1 inline-flex w-full items-center justify-center rounded-lg border border-dashed border-black/20',
              'bg-white/75 px-2.5 py-2 text-[12px] font-semibold text-zinc-500 transition-colors',
              'hover:bg-white hover:text-zinc-800'
            )}
          >
            + Add session
          </button>
        </div>
      </div>

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
