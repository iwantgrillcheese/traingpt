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
  // subtle, premium
  switch (sport) {
    case 'swim':
      return 'bg-sky-300';
    case 'bike':
      return 'bg-indigo-300';
    case 'run':
      return 'bg-emerald-300';
    case 'strength':
      return 'bg-amber-300';
    case 'rest':
      return 'bg-gray-300';
    default:
      return 'bg-gray-300';
  }
}

function sportBadge(sport: string) {
  switch (sport) {
    case 'swim':
      return 'S';
    case 'bike':
      return 'B';
    case 'run':
      return 'R';
    case 'strength':
      return 'ST';
    case 'rest':
      return 'OFF';
    default:
      return '•';
  }
}

// Strip leading emoji if old titles were saved like "🚴 Bike..."
function stripLeadingEmoji(text: string) {
  return text.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '');
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
        opacity: isDragging ? 0.65 : 1,
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatMiles(meters?: number | null) {
  if (!meters || meters <= 0) return null;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

/* ---------- main component ---------- */

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
          // IMPORTANT: DayCell is NOT a "card". MonthGrid owns borders/shape.
          'h-full w-full px-2 py-2 flex flex-col gap-2',
          isOutside ? 'text-gray-400' : 'text-gray-900',
          isOver && 'bg-gray-50',
          justDropped && 'animate-pulse'
        )}
      >
        {/* Day header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-baseline gap-2">
            <div className={clsx('text-xs font-semibold', isOutside ? 'text-gray-400' : 'text-gray-900')}>
              {header.dayNum}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              {header.dayWk}
            </div>
          </div>

          {isToday(date) ? (
            <div className="text-[10px] font-medium text-gray-700 rounded-full border border-gray-200 bg-white px-2 py-0.5">
              Today
            </div>
          ) : null}
        </div>

        {/* Sessions stack */}
        <div className="flex flex-col gap-2">
          {sessions?.map((s) => {
            const rawTitle = s.title ?? '';
            const isRest = rawTitle.toLowerCase().includes('rest day');

            const sportRaw = String(s.sport ?? normalizeSportFromTitle(rawTitle));
            const sport = normalizeSport(sportRaw);
            const accent = sportAccentClass(sport);
            const badge = sportBadge(sport);

            const isStravaMatch = !!s.stravaActivity;
            const isCompleted = isSessionCompleted(s) || isStravaMatch;

            // Split only on ": " so we don't break times/paces
            const [labelLine, ...rest] = rawTitle.split(': ');
            const detailLine = rest.join(': ').trim();

            const baseTitle = stripLeadingEmoji(labelLine?.trim() || 'Untitled');
            const titleLine = isRest ? 'Rest Day' : baseTitle || 'Untitled';

            const activity = s.stravaActivity;
            const duration = formatDuration(activity?.moving_time);
            const distance = formatMiles(activity?.distance);
            const hr = activity?.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : null;
            const watts = activity?.average_watts ? `${Math.round(activity.average_watts)} w` : null;

            return (
              <DraggableSession key={s.id} session={s}>
                <button
                  onClick={() => !isRest && onSessionClick?.(s)}
                  className={clsx(
                    'w-full rounded-lg border px-2 py-2 text-left transition',
                    'bg-white hover:bg-gray-50',
                    isStravaMatch
                      ? 'border-indigo-200 bg-indigo-50'
                      : isCompleted
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200'
                  )}
                  title={rawTitle}
                >
                  <div className="flex items-start gap-2">
                    {/* accent */}
                    <span className={clsx('mt-0.5 h-4 w-1 rounded-full', accent)} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 line-clamp-2">
                            {titleLine}
                          </div>

                          {detailLine ? (
                            <div className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">
                              {detailLine}
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="inline-flex h-5 items-center justify-center rounded-md border border-gray-200 bg-white px-1.5 text-[10px] font-semibold text-gray-700">
                            {badge}
                          </span>

                          {isStravaMatch ? (
                            <span className="text-[10px] font-medium text-indigo-700 rounded-full border border-indigo-200 bg-white px-2 py-0.5">
                              Strava
                            </span>
                          ) : null}

                          {!isStravaMatch && isCompleted ? (
                            <span className="text-[10px] font-semibold text-emerald-700">✓</span>
                          ) : null}
                        </div>
                      </div>

                      {isStravaMatch ? (
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-indigo-900/80">
                          <div className="flex justify-between gap-2">
                            <span className="text-indigo-900/60">Time</span>
                            <span className="font-medium">{duration ?? '—'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-indigo-900/60">Dist</span>
                            <span className="font-medium">{distance ?? '—'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-indigo-900/60">HR</span>
                            <span className="font-medium">{hr ?? '—'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-indigo-900/60">Power</span>
                            <span className="font-medium">{watts ?? '—'}</span>
                          </div>
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
                const key = String((a as any).strava_id ?? a.id);
                const duration = formatDuration(a.moving_time);
                const distance = formatMiles(a.distance);

                return (
                  <div
                    key={key}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-[11px] text-indigo-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium">
                        {a.name || 'Unplanned activity'}
                      </div>
                      <span className="text-[10px] font-medium text-indigo-700 rounded-full border border-indigo-200 bg-white px-2 py-0.5">
                        Strava-only
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-indigo-900/70">
                      <span>{duration ?? '—'}</span>
                      <span>{distance ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Add session */}
          <button
            onClick={() => setShowForm(true)}
            className={clsx(
              'mt-1 inline-flex items-center justify-center rounded-lg border border-dashed',
              'border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:text-gray-900',
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
