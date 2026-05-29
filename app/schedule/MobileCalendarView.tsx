'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import AddSessionModalTP from './AddSessionModalTP';
import SessionModal from './SessionModal';
import type { CompletedSession, Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import { getCompletionStatus } from './session-utils';

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
  if (value === 'swim') return 'bg-blue-500';
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
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');

  const sessionsForSelectedDate = useMemo(() => {
    return localSessions
      .filter((session) => session.date === selectedKey)
      .sort((a, b) => String(a.sport ?? '').localeCompare(String(b.sport ?? '')));
  }, [localSessions, selectedKey]);

  const nextSession = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return localSessions
      .filter((session) => parseDate(session.date) >= today)
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0] ?? null;
  }, [localSessions]);

  const completedThisWeek = useMemo(() => {
    const keys = new Set(weekDays.map((date) => format(date, 'yyyy-MM-dd')));
    return localSessions.filter((session) => {
      if (!keys.has(session.date)) return false;
      const status = getCompletionStatus({ date: session.date, title: session.title, stravaActivity: session.stravaActivity }, localCompleted);
      return Boolean(session.stravaActivity) || status === 'done';
    }).length;
  }, [localSessions, localCompleted, weekDays]);

  return (
    <main className="min-h-[100dvh] bg-[#FAFAF7] px-4 pb-24 pt-4">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Schedule</div>
          <h1 className="mt-1 text-[30px] font-semibold tracking-tight text-zinc-950">Today</h1>
          <p className="mt-1 text-[13px] text-zinc-500">{weekPhase || 'Your training week'}</p>
        </div>
        <button
          type="button"
          onClick={() => setAddSessionDate(selectedDate)}
          className="rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)]"
        >
          + Add
        </button>
      </header>

      <section className="mb-4 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">This week</div>
            <div className="mt-1 text-[15px] font-semibold text-zinc-950">{format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}</div>
          </div>
          <div className="text-right text-[12px] text-zinc-500">
            <span className="font-semibold text-zinc-950">{completedThisWeek}</span> completed
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date) => {
            const active = isSameDay(date, selectedDate);
            const key = format(date, 'yyyy-MM-dd');
            const count = localSessions.filter((session) => session.date === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={clsx(
                  'rounded-2xl px-2 py-2 text-center transition-colors',
                  active ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-600'
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">{format(date, 'EEE')}</div>
                <div className="mt-1 text-[16px] font-semibold">{format(date, 'd')}</div>
                {count ? <div className={clsx('mx-auto mt-1 h-1 w-1 rounded-full', active ? 'bg-white' : 'bg-zinc-400')} /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {nextSession ? (
        <section className="mb-4 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Next up</div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="line-clamp-2 text-[17px] font-semibold leading-tight text-zinc-950">{cleanTitle(nextSession.title)}</div>
              <div className="mt-1 text-[13px] text-zinc-500">{format(parseDate(nextSession.date), 'EEE, MMM d')} · {normalizeSport(nextSession.sport)}</div>
            </div>
            <button type="button" onClick={() => setSelectedSession(nextSession)} className="shrink-0 rounded-xl bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white">
              View
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{format(selectedDate, 'EEEE')}</div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-zinc-950">{format(selectedDate, 'MMMM d')}</h2>
          </div>
          <button type="button" onClick={() => setAddSessionDate(selectedDate)} className="rounded-xl border border-zinc-200 px-3 py-2 text-[13px] font-semibold text-zinc-700">
            Add
          </button>
        </div>

        <div className="space-y-3">
          {sessionsForSelectedDate.length ? (
            sessionsForSelectedDate.map((session) => {
              const status = getCompletionStatus({ date: session.date, title: session.title, stravaActivity: session.stravaActivity }, localCompleted);
              const completed = Boolean(session.stravaActivity) || status === 'done';
              const skipped = status === 'skipped';
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSession(session)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-left transition-colors hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={clsx('h-2 w-2 rounded-full', sportDot(session.sport))} />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{normalizeSport(session.sport)}</span>
                      </div>
                      <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-zinc-950">{cleanTitle(session.title)}</div>
                      <div className="mt-1 text-[13px] text-zinc-500">{formatMinutes(session.duration ?? null) || 'Planned'}</div>
                    </div>
                    {completed ? <span className="text-[12px] font-semibold text-emerald-700">Done</span> : null}
                    {skipped ? <span className="text-[12px] font-semibold text-zinc-500">Skipped</span> : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-[13px] text-zinc-500">
              No session scheduled. Add one or use this as recovery time.
            </div>
          )}
        </div>
      </section>

      <SessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        completedSessions={localCompleted}
        onCompletedUpdate={setLocalCompleted}
        onSessionDeleted={(sessionId) => {
          setLocalSessions((prev) => prev.filter((session) => session.id !== sessionId));
          onSessionDeleted?.(sessionId);
        }}
        onSessionUpdated={(updated) => {
          setLocalSessions((prev) => prev.map((session) => (session.id === updated.id ? { ...session, ...updated } : session)));
          setSelectedSession((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
        }}
        weekLabel={`${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d')}`}
        weekPhase={weekPhase}
        raceGoal={raceGoal}
      />

      <AddSessionModalTP
        open={!!addSessionDate}
        date={addSessionDate ?? selectedDate}
        onClose={() => setAddSessionDate(null)}
        onAdded={(newSession: Session) => {
          setLocalSessions((prev) => [...prev, newSession as MergedSession]);
          setAddSessionDate(null);
        }}
      />
    </main>
  );
}
