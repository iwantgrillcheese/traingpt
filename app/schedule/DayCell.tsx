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

function sportAccent(sport: string) {
  switch (sport) {
    case 'swim':
      return { rail: 'bg-slate-700/80', text: 'text-slate-700' };
    case 'bike':
      return { rail: 'bg-zinc-900/70', text: 'text-zinc-700' };
    case 'run':
      return { rail: 'bg-emerald-800/75', text: 'text-emerald-800' };
    case 'strength':
      return { rail: 'bg-violet-800/70', text: 'text-violet-800' };
    case 'rest':
      return { rail: 'bg-zinc-500/60', text: 'text-zinc-600' };
    default:
      return { rail: 'bg-zinc-600/55', text: 'text-zinc-700' };
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
        opacity: isDragging ? 0.85 : 1,
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
    const timer = setTimeout(() => setJustDropped(false), 350);
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
          'h-full w-full',
          // TP density: less padding
          'px-2.5 py-2',
          'transition-colors',
          isOutside && 'opacity-60',
          isOver && 'bg-black/[0.015]',
          justDropped && 'animate-pulse'
        )}
      >
        {/* Day header (tight) */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div
              className={clsx(
                'text-[13px] font-semibold tracking-tight',
                isOutside ? 'text-zinc-400' : 'text-zinc-950'
              )}
            >
              {header.dayNum}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {header.dayWk}
            </div>
          </div>

          {/* TP-like today mark: small dot, not a pill */}
          {dayIsToday ? <div className="h-1.5 w-1.5 rounded-full bg-zinc-900/40" /> : null}
        </div>

        {/* Sessions (compact rows) */}
        <div className="mt-2 flex flex-col gap-1.5">
          {sessions?.map((s) => {
            const rawTitle = s.title ?? '';

            const sportRaw = String(s.sport ?? normalizeSportFromTitle(rawTitle));
            const sport = normalizeSport(sportRaw);

            const isRest =
              rawTitle.toLowerCase().includes('rest day') || sport.toLowerCase() === 'rest';

            const isStravaMatch = !!s.stravaActivity;
            const isCompleted = isSessionCompleted(s) || isStravaMatch;

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
                    'w-full text-left',
                    'rounded-md border border-black/10 bg-white',
                    // TP-ish: row highlight, not "card lift"
                    'hover:bg-zinc-50/70 active:bg-zinc-50',
                    'transition-colors',
                    // completed/strava subtle ring
                    (isStravaMatch || isCompleted) && 'ring-1 ring-black/5'
                  )}
                  title={rawTitle}
                >
                  <div className="flex">
                    {/* Rail (thinner, TP-ish) */}
                    <div className={clsx('w-[3px]', accent.rail)} />

                    {/* Body */}
                    <div className="min-w-0 flex-1 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 text-[12.5px] font-semibold leading-snug text-zinc-950 line-clamp-2">
                              {titleLine}
                            </div>

                            {/* status marks */}
                            {isStravaMatch ? (
                              <span className="shrink-0 rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                                Strava
                              </span>
                            ) : null}

                            {!isStravaMatch && isCompleted ? (
                              <span className={clsx('shrink-0 text-[11px] font-semibold', accent.text)}>
                                ✓
                              </span>
                            ) : null}
                          </div>

                          {detailLine ? (
                            <div className="mt-0.5 text-[11px] leading-snug text-zinc-500 line-clamp-1">
                              {detailLine}
                            </div>
                          ) : null}
                        </div>

                        {/* Right-side meta (TP-ish) */}
                        {isStravaMatch ? (
                          <div className="shrink-0 text-right text-[10.5px] leading-tight text-zinc-500">
                            <div>{duration ?? '—'}</div>
                            <div>{distance ?? '—'}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              </DraggableSession>
            );
          })}

          {/* Strava-only extras (unmatched only) */}
          {extraActivities?.length > 0 ? (
            <div className="mt-0.5 flex flex-col gap-1.5">
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
                      'w-full text-left rounded-md border border-black/10 bg-white',
                      'hover:bg-zinc-50/70 transition-colors',
                      // subtle ring so it reads as "imported"
                      'ring-1 ring-black/5'
                    )}
                    title={a.name || 'Strava activity'}
                  >
                    <div className="flex">
                      <div className={clsx('w-[3px]', accent.rail)} />
                      <div className="min-w-0 flex-1 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 text-[12.5px] font-semibold leading-snug text-zinc-950 line-clamp-2">
                                {a.name || 'Unplanned Activity'}
                              </div>
                              <span className="shrink-0 rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                                Strava
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">
                              Strava activity (not in plan)
                            </div>
                          </div>

                          <div className="shrink-0 text-right text-[10.5px] leading-tight text-zinc-500">
                            <div>{duration ?? '—'}</div>
                            <div>{distance ?? '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Add session (TP-ish link row) */}
          <button
            onClick={() => setShowForm(true)}
            className={clsx(
              'mt-1 inline-flex w-full items-center justify-center',
              'rounded-md border border-dashed border-black/15',
              'bg-white/60 px-2.5 py-2',
              'text-[12px] font-medium text-zinc-500 hover:text-zinc-800',
              'hover:bg-white transition-colors'
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
