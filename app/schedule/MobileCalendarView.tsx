'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import AddSessionModalTP from './AddSessionModalTP';
import SessionModal from './SessionModal';
import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';

type Props = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  stravaActivities?: StravaActivity[];
  onSessionDeleted?: (sessionId: string) => void;
  weekPhase?: string | null;
  raceGoal?: string | null;
};

function parseDate(value: string) {
  try {
    return parseISO(value);
  } catch {
    return new Date();
  }
}

function normalizeSport(value?: string | null) {
  const v = String(value ?? '').toLowerCase();
  if (v.includes('swim')) return 'Swim';
  if (v.includes('bike') || v.includes('ride')) return 'Bike';
  if (v.includes('run')) return 'Run';
  if (v.includes('strength')) return 'Strength';
  if (v.includes('rest')) return 'Rest';
  return 'Session';
}

function sportDot(sport?: string | null) {
  const value = normalizeSport(sport).toLowerCase();
  if (value === 'swim') return 'bg-sky-500';
  if (value === 'bike') return 'bg-emerald-500';
  if (value === 'run') return 'bg-orange-500';
  if (value === 'strength') return 'bg-violet-500';
  return 'bg-zinc-300';
}

function cleanTitle(title?: string | null) {
  return String(title ?? 'Untitled session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .trim();
}

function formatMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function getWeekDays(anchor = new Date()) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getCompletionStatus(session: MergedSession, completedSessions: CompletedSession[]) {
  const match = completedSessions.find((item) => item.date === session.date && item.session_title === session.title);
  if (!match) return null;
  return match.status === 'skipped' ? 'skipped' : 'done';
}

export default function MobileCalendarView({
  sessions,
  completedSessions,
  stravaActivities = [],
  onSessionDeleted,
  weekPhase,
  raceGoal,
}: Props) {
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);
  const [localCompleted, setLocalCompleted] = useState<CompletedSession[]>(completedSessions);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);

  useEffect(() => setLocalSessions(sessions), [sessions]);
  useEffect(() => setLocalCompleted(completedSessions), [completedSessions]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const sessionsForSelectedDate = useMemo(() => {
    return localSessions.filter((session) => isSameDay(parseDate(session.date), selectedDate));
  }, [localSessions, selectedDate]);

  const nextSession = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return localSessions
      .filter((session) => parseDate(session.date) >= today)
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0] ?? null;
  }, [localSessions]);

  const selectedDateLabel = format(selectedDate, 'EEEE, MMMM d');

  const handleSessionDeleted = (sessionId: string) => {
    setLocalSessions((prev) => prev.filter((session) => session.id !== sessionId));
    setSelectedSession(null);
    onSessionDeleted?.(sessionId);
  };

  const handleSessionUpdated = (updated: MergedSession) => {
    setLocalSessions((prev) => prev.map((session) => (session.id === updated.id ? { ...session, ...updated } : session)));
    setSelectedSession((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  };

  const weekCompletion = useMemo(() => {
    const weekDateKeys = new Set(weekDays.map((date) => format(date, 'yyyy-MM-dd')));
    const weekSessions = localSessions.filter((session) => weekDateKeys.has(session.date));
    const done = weekSessions.filter((session) => Boolean(session.stravaActivity) || getCompletionStatus(session, localCompleted) === 'done').length;
    return { done, total: weekSessions.length };
  }, [weekDays, localSessions, localCompleted]);

  return (
    <main className="min-h-[100dvh] bg-white text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[26px] font-semibold tracking-tight text-zinc-950">Schedule</div>
            <div className="mt-1 text-[13px] text-zinc-500">{weekPhase || 'This week'} · {weekCompletion.done}/{weekCompletion.total || 0} complete</div>
          </div>
          <button
            type="button"
            onClick={() => setAddSessionDate(selectedDate)}
            className="mt-1 rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white"
          >
            + Add
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {weekDays.map((date) => {
            const active = isSameDay(date, selectedDate);
            const hasSession = localSessions.some((session) => isSameDay(parseDate(session.date), date));
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={clsx(
                  'rounded-2xl border px-1 py-2 text-center transition-colors',
                  active ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-700'
                )}
              >
                <div className={clsx('text-[10px] font-medium uppercase tracking-[0.08em]', active ? 'text-zinc-300' : 'text-zinc-400')}>{format(date, 'EEE')}</div>
                <div className="mt-1 text-[15px] font-semibold">{format(date, 'd')}</div>
                <div className="mt-1 flex h-1 items-center justify-center">
                  {hasSession ? <span className={clsx('h-1 w-1 rounded-full', active ? 'bg-white' : 'bg-zinc-950')} /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-4 py-5">
        {nextSession ? (
          <section className="mb-5 rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Next session</div>
            <div className="mt-2 text-[18px] font-semibold leading-tight text-zinc-950">{cleanTitle(nextSession.title)}</div>
            <div className="mt-2 text-[13px] text-zinc-500">{format(parseDate(nextSession.date), 'EEE, MMM d')} · {normalizeSport(nextSession.sport)}{formatMinutes(nextSession.duration ?? null) ? ` · ${formatMinutes(nextSession.duration ?? null)}` : ''}</div>
            <button type="button" onClick={() => setSelectedSession(nextSession)} className="mt-4 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-[14px] font-semibold text-white">
              View workout
            </button>
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[20px] font-semibold tracking-tight text-zinc-950">{selectedDateLabel}</div>
              {raceGoal ? <div className="mt-1 text-[13px] text-zinc-500">{raceGoal}</div> : null}
            </div>
          </div>

          {sessionsForSelectedDate.length ? (
            <div className="space-y-3">
              {sessionsForSelectedDate.map((session) => {
                const status = getCompletionStatus(session, localCompleted);
                const done = Boolean(session.stravaActivity) || status === 'done';
                const skipped = status === 'skipped';
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSession(session)}
                    className="w-full rounded-3xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className={clsx('h-2 w-2 rounded-full', sportDot(session.sport))} />
                          <span className="text-[12px] font-medium text-zinc-500">{normalizeSport(session.sport)}</span>
                        </div>
                        <div className="text-[16px] font-semibold leading-tight text-zinc-950">{cleanTitle(session.title)}</div>
                        <div className="mt-2 text-[13px] text-zinc-500">{formatMinutes(session.duration ?? null) || 'Duration not set'}</div>
                      </div>
                      {done ? <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white">Done</span> : null}
                      {skipped ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">Skipped</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-10 text-center">
              <div className="text-[15px] font-semibold text-zinc-950">No session planned</div>
              <div className="mt-1 text-[13px] text-zinc-500">Add a workout or use this as a recovery day.</div>
              <button type="button" onClick={() => setAddSessionDate(selectedDate)} className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-zinc-800">
                Add session
              </button>
            </div>
          )}
        </section>
      </div>

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        completedSessions={localCompleted}
        onCompletedUpdate={setLocalCompleted}
        onSessionDeleted={handleSessionDeleted}
        onSessionUpdated={handleSessionUpdated}
        weekPhase={weekPhase}
        raceGoal={raceGoal}
      />

      <AddSessionModalTP
        open={!!addSessionDate}
        date={addSessionDate ?? new Date()}
        onClose={() => setAddSessionDate(null)}
        onAdded={(row: MergedSession) => {
          setLocalSessions((prev) => [...prev, row]);
          setAddSessionDate(null);
        }}
      />
    </main>
  );
}
