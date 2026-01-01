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
  const lower = (title || '').toLowerCase();
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

function stripLeadingEmoji(text: string) {
  return (text || '').replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '');
}

// Your “B.” “R.” “S.” “L.” system — treat it as a compact badge, not the title.
function parseCompactPrefix(labelLine: string) {
  const s = (labelLine || '').trim();

  // Accept: "B.", "R.", "S.", "L.", "O.", "ST."
  // Return prefix and the remaining label content (if any).
  const match = s.match(/^([A-Za-z]{1,2}\.)\s*(.*)$/);
  if (!match) return { prefix: null as string | null, rest: s };

  const prefix = match[1];
  const rest = (match[2] || '').trim();
  return { prefix, rest };
}

function fallbackTitleFromSport(sport: string) {
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

// This is the key: ensure we always surface “the workout”, not the prefix.
function getReadableTitle({
  rawTitle,
  sport,
}: {
  rawTitle: string;
  sport: string;
}): { badge: string | null; title: string; detail: string } {
  const cleaned = stripLeadingEmoji(rawTitle || '').trim();

  // Split only on ": " to preserve times like 7:15/mi.
  const [labelLineRaw, ...restParts] = cleaned.split(': ');
  const labelLine = (labelLineRaw || '').trim();
  const detailLine = restParts.join(': ').trim();

  const { prefix: badge, rest } = parseCompactPrefix(labelLine);

  // If labelLine is just "B." and detail exists, treat detail as the title.
  // If labelLine has content after the badge ("B. Tempo Run"), use it as title.
  // Otherwise fall back to sport name.
  let title = rest || labelLine;

  // title could still be "B." or empty
  if (!title || title === badge) {
    title = detailLine || fallbackTitleFromSport(sport);
  }

  // If we used detailLine as title, we don’t want to repeat it as detail.
  const detail =
    title === detailLine
      ? ''
      : detailLine;

  return { badge, title, detail };
}

function sportAccentClass(sport: string) {
  switch (sport) {
    case 'swim':
      return 'bg-sky-200';
    case 'bike':
      return 'bg-indigo-200';
    case 'run':
      return 'bg-emerald-200';
    case 'strength':
      return 'bg-amber-200';
    case 'rest':
      return 'bg-gray-200';
    default:
      return 'bg-gray-200';
  }
}

function badgeToneClass(sport: string) {
  // subtle chip styling keyed to sport
  switch (sport) {
    case 'swim':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'bike':
      return 'border-indigo-200 bg-indigo-50 text-indigo-800';
    case 'run':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'strength':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'rest':
      return 'border-gray-200 bg-gray-50 text-gray-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
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
          'group min-h-[210px] w-full rounded-2xl border p-3 flex flex-col gap-2 transition-all',
          'bg-white border-gray-200 shadow-[0_1px_0_rgba(0,0,0,0.03)]',
          isOutside && 'bg-gray-50 text-gray-400 border-gray-200',
          isToday(date) && 'ring-1 ring-gray-900/10 border-gray-300',
          isOver && 'bg-gray-50 border-gray-300',
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

          <div className="flex items-center gap-2">
            {isToday(date) ? (
              <div className="text-[11px] font-medium text-gray-700 rounded-full border border-gray-200 bg-white px-2 py-0.5">
                Today
              </div>
            ) : null}

            {/* Desktop: hover-only add button */}
            <button
              onClick={() => setShowForm(true)}
              className={clsx(
                'hidden md:inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600',
                'opacity-0 group-hover:opacity-100 transition hover:bg-gray-50'
              )}
            >
              + Add
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex flex-col gap-2">
          {sessions?.map((s) => {
            const rawTitle = s.title ?? '';
            const isRest = rawTitle.toLowerCase().includes('rest day');

            const sportRaw = String(s.sport ?? normalizeSportFromTitle(rawTitle));
            const sport = normalizeSport(sportRaw);
            const accent = sportAccentClass(sport);

            const isStravaMatch = !!s.stravaActivity;
            const isCompleted = isSessionCompleted(s) || isStravaMatch;

            const { badge, title, detail } = getReadableTitle({ rawTitle, sport });

            const activity = s.stravaActivity;
            const duration =
              activity?.moving_time != null
                ? `${Math.floor(activity.moving_time / 3600)}h ${Math.round((activity.moving_time % 3600) / 60)}m`
                : null;
            const distance =
              activity?.distance != null ? `${(activity.distance / 1609).toFixed(1)} mi` : null;
            const hr =
              activity?.average_heartrate != null ? `${Math.round(activity.average_heartrate)} bpm` : null;
            const watts =
              activity?.average_watts != null ? `${Math.round(activity.average_watts)}w` : null;

            return (
              <DraggableSession key={s.id} session={s}>
                <button
                  onClick={() => !isRest && onSessionClick?.(s)}
                  className={clsx(
                    'w-full text-left rounded-xl border px-3 py-2 transition',
                    'hover:bg-gray-50 hover:border-gray-300',
                    isStravaMatch
                      ? 'bg-indigo-50 border-indigo-200'
                      : isCompleted
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-gray-200'
                  )}
                  title={rawTitle}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2.5">
                        {/* Left accent bar */}
                        <span className={clsx('mt-1.5 h-4 w-1.5 rounded-full', accent)} />

                        {/* Badge (B./R./S./L.) */}
                        {badge ? (
                          <span
                            className={clsx(
                              'shrink-0 inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold',
                              badgeToneClass(sport)
                            )}
                          >
                            {badge}
                          </span>
                        ) : null}

                        {/* Text */}
                        <div className="min-w-0">
                          {/* IMPORTANT: no truncate. Use clamp so it’s readable like Intervals. */}
                          <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                            {isRest ? 'Rest Day' : title}
                          </div>

                          {detail ? (
                            <div className="mt-0.5 text-xs text-gray-600 leading-snug line-clamp-2">
                              {detail}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isStravaMatch ? (
                        <span className="text-[11px] font-medium text-indigo-700 rounded-full border border-indigo-200 bg-white px-2 py-0.5">
                          Strava
                        </span>
                      ) : null}

                      {!isStravaMatch && isCompleted ? (
                        <span className="text-[11px] font-semibold text-emerald-700">✓</span>
                      ) : null}
                    </div>
                  </div>

                  {isStravaMatch ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-indigo-900/80">
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
                </button>
              </DraggableSession>
            );
          })}

          {/* Strava-only extras (UNMATCHED ONLY) */}
          {extraActivities?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {extraActivities.map((a) => {
                const key = String((a as any).strava_id ?? a.id);

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {a.name || 'Unplanned Activity'}
                        </div>
                        <div className="mt-0.5 flex justify-between text-[11px] text-indigo-900/70">
                          <span>{a.moving_time ? `${Math.floor(a.moving_time / 60)}m` : '—'}</span>
                          <span>{a.distance ? `${(a.distance / 1609).toFixed(1)} mi` : '—'}</span>
                        </div>
                      </div>

                      <span className="shrink-0 text-[11px] font-medium text-indigo-700 rounded-full border border-indigo-200 bg-white px-2 py-0.5">
                        Strava-only
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Mobile add session (visible). Desktop uses hover in header */}
          <button
            onClick={() => setShowForm(true)}
            className={clsx(
              'mt-1 inline-flex items-center justify-center rounded-xl border border-dashed',
              'border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:text-gray-900',
              'hover:bg-gray-50 transition md:hidden'
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
