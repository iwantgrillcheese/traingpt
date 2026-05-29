'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, isBefore, isToday, parseISO, startOfDay } from 'date-fns';
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

function parseDate(value?: string | null) {
  if (!value) return new Date();

  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  } catch {
    return new Date();
  }
}

function dateKey(value?: string | null) {
  return format(parseDate(value), 'yyyy-MM-dd');
}

function normalizeSport(value?: string | null) {
  const v = String(value ?? '').toLowerCase();

  if (v.includes('swim')) return 'Swim';
  if (v.includes('bike') || v.includes('ride')) return 'Bike';
  if (v.includes('run')) return 'Run';
  if (v.includes('brick')) return 'Brick';
  if (v.includes('strength')) return 'Strength';
  if (v.includes('rest')) return 'Rest';

  return 'Session';
}

function cleanTitle(title?: string | null) {
  return String(title ?? 'Untitled session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/^[\s—–-]+/, '')
    .replace(/^[\s:•·]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;

  if (value < 60) return `${Math.round(value)} min`;

  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);

  return m ? `${h}h ${m}m` : `${h}h`;
}

function getCompletionStatus(session: MergedSession, completedSessions: CompletedSession[]) {
  const match = completedSessions.find(
    (item) => item.date === session.date && item.session_title === session.title
  );

  if (!match) return null;

  return match.status === 'skipped' ? 'skipped' : 'done';
}

function getSessionStatus(session: MergedSession, completedSessions: CompletedSession[]) {
  const manualStatus = getCompletionStatus(session, completedSessions);

  if (manualStatus === 'skipped') return 'skipped';
  if (manualStatus === 'done' || session.stravaActivity) return 'done';

  const sessionDay = startOfDay(parseDate(session.date));
  const today = startOfDay(new Date());

  if (isBefore(sessionDay, today)) return 'missed';

  return 'planned';
}

function statusLabel(status: ReturnType<typeof getSessionStatus>) {
  if (status === 'done') return 'Done';
  if (status === 'skipped') return 'Skipped';
  if (status === 'missed') return 'Past';
  return 'Planned';
}

function statusClass(status: ReturnType<typeof getSessionStatus>) {
  if (status === 'done') return 'bg-zinc-950 text-white';
  if (status === 'skipped') return 'bg-zinc-100 text-zinc-500';
  if (status === 'missed') return 'bg-white text-zinc-400 ring-1 ring-inset ring-zinc-200';
  return 'bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200';
}

function groupSessionsByDate(sessions: MergedSession[]) {
  const grouped = new Map<string, MergedSession[]>();

  sessions.forEach((session) => {
    const key = dateKey(session.date);
    const existing = grouped.get(key) ?? [];
    existing.push(session);
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => parseDate(a).getTime() - parseDate(b).getTime())
    .map(([key, items]) => ({
      key,
      date: parseDate(key),
      sessions: items.slice().sort((a, b) => {
        const aSport = normalizeSport(a.sport);
        const bSport = normalizeSport(b.sport);
        return aSport.localeCompare(bSport);
      }),
    }));
}

function getPlanRangeLabel(groups: ReturnType<typeof groupSessionsByDate>) {
  if (!groups.length) return 'No sessions yet';

  const first = groups[0].date;
  const last = groups[groups.length - 1].date;

  if (format(first, 'yyyy') !== format(last, 'yyyy')) {
    return `${format(first, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;
  }

  if (format(first, 'MMM') !== format(last, 'MMM')) {
    return `${format(first, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`;
  }

  return `${format(first, 'MMM d')} – ${format(last, 'd, yyyy')}`;
}

export default function MobileCalendarView({
  sessions,
  completedSessions,
  onSessionDeleted,
  weekPhase,
  raceGoal,
}: Props) {
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);
  const [localCompleted, setLocalCompleted] = useState<CompletedSession[]>(completedSessions);
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);

  useEffect(() => setLocalSessions(sessions), [sessions]);
  useEffect(() => setLocalCompleted(completedSessions), [completedSessions]);

  const groups = useMemo(() => groupSessionsByDate(localSessions), [localSessions]);

  const completion = useMemo(() => {
    const done = localSessions.filter(
      (session) => getSessionStatus(session, localCompleted) === 'done'
    ).length;

    return {
      done,
      total: localSessions.length,
    };
  }, [localSessions, localCompleted]);

  const nextSession = useMemo(() => {
    const today = startOfDay(new Date());

    return (
      localSessions
        .filter((session) => startOfDay(parseDate(session.date)) >= today)
        .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0] ?? null
    );
  }, [localSessions]);

  const handleSessionDeleted = (sessionId: string) => {
    setLocalSessions((prev) => prev.filter((session) => session.id !== sessionId));
    setSelectedSession(null);
    onSessionDeleted?.(sessionId);
  };

  const handleSessionUpdated = (updated: MergedSession) => {
    setLocalSessions((prev) =>
      prev.map((session) => (session.id === updated.id ? { ...session, ...updated } : session))
    );
    setSelectedSession((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  };

  return (
    <main className="min-h-[100dvh] bg-[#fbfbfa] text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-[#fbfbfa]/95 px-5 pb-4 pt-5 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-zinc-950">
              Schedule
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-zinc-500">
              {getPlanRangeLabel(groups)}
              {weekPhase ? ` · ${weekPhase}` : ''}
              {completion.total ? ` · ${completion.done}/${completion.total} complete` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAddSessionDate(new Date())}
            className="shrink-0 rounded-full bg-zinc-950 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm active:scale-[0.99]"
          >
            + Add
          </button>
        </div>

        {nextSession ? (
          <button
            type="button"
            onClick={() => setSelectedSession(nextSession)}
            className="mt-4 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Next up
            </div>
            <div className="mt-1 line-clamp-2 text-[15px] font-semibold leading-5 tracking-[-0.02em] text-zinc-950">
              {cleanTitle(nextSession.title)}
            </div>
            <div className="mt-1 text-[12px] text-zinc-500">
              {format(parseDate(nextSession.date), 'EEE, MMM d')} · {normalizeSport(nextSession.sport)}
              {formatMinutes(nextSession.duration ?? null)
                ? ` · ${formatMinutes(nextSession.duration ?? null)}`
                : ''}
            </div>
          </button>
        ) : null}
      </header>

      <div className="px-5 pb-28 pt-5">
        {groups.length ? (
          <div className="space-y-7">
            {groups.map((group) => {
              const today = isToday(group.date);

              return (
                <section key={group.key} className="scroll-mt-28">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-zinc-950">
                          {today ? 'Today' : format(group.date, 'EEEE')}
                        </h2>
                        {today ? (
                          <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                            Today
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[13px] text-zinc-500">
                        {format(group.date, 'MMMM d')}
                        {raceGoal ? ` · ${raceGoal}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAddSessionDate(group.date)}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {group.sessions.map((session) => {
                      const status = getSessionStatus(session, localCompleted);
                      const duration = formatMinutes(session.duration ?? null);
                      const sport = normalizeSport(session.sport);

                      return (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => setSelectedSession(session)}
                          className="block w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] active:scale-[0.997]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
                                <span>{sport}</span>
                                {duration ? (
                                  <>
                                    <span className="text-zinc-300">·</span>
                                    <span>{duration}</span>
                                  </>
                                ) : null}
                              </div>

                              <div className="mt-2 line-clamp-2 text-[16px] font-semibold leading-5 tracking-[-0.02em] text-zinc-950">
                                {cleanTitle(session.title)}
                              </div>

                              {session.stravaActivity ? (
                                <div className="mt-2 text-[12px] font-medium text-zinc-500">
                                  Imported from Strava
                                </div>
                              ) : null}
                            </div>

                            <span
                              className={clsx(
                                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                statusClass(status)
                              )}
                            >
                              {statusLabel(status)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-5 py-12 text-center">
            <div className="text-[17px] font-semibold tracking-[-0.02em] text-zinc-950">
              No sessions yet
            </div>
            <div className="mx-auto mt-2 max-w-[260px] text-[13px] leading-5 text-zinc-500">
              Generate a plan or add your first workout manually.
            </div>
            <button
              type="button"
              onClick={() => setAddSessionDate(new Date())}
              className="mt-5 rounded-full bg-zinc-950 px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Add session
            </button>
          </div>
        )}
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
