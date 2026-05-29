'use client';

import { useMemo, useState } from 'react';
import { addDays, endOfWeek, format, isAfter, isBefore, parseISO, startOfDay, startOfWeek, subDays } from 'date-fns';

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import FitnessPanel from '@/app/coaching/FitnessPanel';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';
import CoachChatModal from '@/app/components/CoachChatModal';
import type { CoachingContextPayload } from '@/types/coaching-context';

type CompletedRow = {
  user_id?: string;
  date?: string;
  session_date?: string;
  session_title?: string;
  title?: string;
  sport?: string | null;
  duration?: number | null;
  status?: 'done' | 'skipped' | string | null;
};

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: CompletedRow[];
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: any;
  stravaConnected: boolean;
  raceDate?: string | null;
  initialPrompt?: string;
  initialContext?: CoachingContextPayload | null;
};

type SportBucket = 'Swim' | 'Bike' | 'Run' | 'Strength' | 'Other';

function safeParseDate(value?: string | null): Date | null {
  if (!value) return null;

  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function isWithinRange(date: Date, start: Date, end: Date) {
  return !isBefore(date, start) && !isAfter(date, end);
}

function getCompletedDate(row: CompletedRow): string | undefined {
  return row.session_date ?? row.date ?? undefined;
}

function estimateDurationFromTitle(title?: string | null): number {
  if (!title) return 45;

  const hours = title.match(/(\d{1,3}(?:\.\d+)?)\s*(hr|hour|hours)/i);
  if (hours) {
    const parsed = Number.parseFloat(hours[1]);
    if (Number.isFinite(parsed)) return Math.round(parsed * 60);
  }

  const mins = title.match(/(\d{1,3})\s*min/i);
  if (mins) {
    const parsed = Number.parseInt(mins[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 45;
}

function sessionDurationMinutes(session: Session): number {
  if (typeof session.duration === 'number' && Number.isFinite(session.duration)) {
    return Math.max(0, session.duration);
  }

  return estimateDurationFromTitle(session.title);
}

function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDelta(minutes: number): string {
  if (Math.abs(minutes) < 5) return 'flat vs last week';
  return `${minutes > 0 ? '+' : '−'}${formatMinutes(Math.abs(minutes))} vs last week`;
}

function normalizeSport(input?: string | null): SportBucket {
  const value = String(input ?? '').toLowerCase();

  if (value.includes('swim')) return 'Swim';
  if (value.includes('bike') || value.includes('ride') || value.includes('virtualride')) return 'Bike';
  if (value.includes('run')) return 'Run';
  if (value.includes('strength') || value.includes('gym')) return 'Strength';

  return 'Other';
}

function sportDotClass(sport: SportBucket | string) {
  const normalized = normalizeSport(String(sport));
  if (normalized === 'Swim') return 'bg-sky-500';
  if (normalized === 'Bike') return 'bg-orange-500';
  if (normalized === 'Run') return 'bg-emerald-500';
  if (normalized === 'Strength') return 'bg-violet-500';
  return 'bg-zinc-400';
}

function getActivityDate(activity: StravaActivity): Date | null {
  return safeParseDate(activity.start_date_local || activity.start_date);
}

function raceCountdown(raceDate?: string | null) {
  const race = safeParseDate(raceDate);
  if (!race) return null;

  const diff = Math.ceil(
    (startOfDay(race).getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, diff);
}

function sessionScore(session: Session) {
  const title = `${session.title ?? ''} ${session.details ?? ''}`.toLowerCase();
  const duration = sessionDurationMinutes(session);
  let score = 0;

  if (title.includes('long')) score += 8;
  if (title.includes('brick')) score += 8;
  if (title.includes('threshold')) score += 7;
  if (title.includes('tempo')) score += 6;
  if (title.includes('interval')) score += 6;
  if (title.includes('race')) score += 5;
  if (title.includes('endurance')) score += 3;
  if (duration >= 90) score += 4;
  if (duration >= 150) score += 4;
  if (session.sport === 'Rest') score -= 10;

  return score;
}

function getSessionDateLabel(session: Session) {
  const parsed = safeParseDate(session.date);
  return parsed ? format(parsed, 'EEE, MMM d') : 'Date TBD';
}

function getCompletedTitle(row: CompletedRow) {
  return row.session_title ?? row.title ?? '';
}

function buildWeeklyReview({
  completedCount,
  plannedCount,
  actualMinutes,
  plannedMinutes,
  deltaMinutes,
  keySessions,
}: {
  completedCount: number;
  plannedCount: number;
  actualMinutes: number;
  plannedMinutes: number;
  deltaMinutes: number;
  keySessions: Session[];
}) {
  if (plannedCount === 0 && actualMinutes === 0) {
    return 'No meaningful training data is available for this week yet. Once your plan and Strava sessions are connected, this will summarize how the week is tracking.';
  }

  const completionText =
    plannedCount > 0
      ? `You have completed ${completedCount} of ${plannedCount} planned sessions this week`
      : 'You have logged training this week';

  const volumeText =
    plannedMinutes > 0
      ? `with ${formatMinutes(actualMinutes)} trained against ${formatMinutes(plannedMinutes)} planned`
      : `with ${formatMinutes(actualMinutes)} logged`;

  const trendText =
    Math.abs(deltaMinutes) < 5
      ? 'Training volume is essentially flat compared with last week.'
      : deltaMinutes > 0
        ? `Training volume is up ${formatMinutes(deltaMinutes)} compared with last week.`
        : `Training volume is down ${formatMinutes(Math.abs(deltaMinutes))} compared with last week.`;

  const keyText =
    keySessions.length > 0
      ? `The sessions to protect are ${keySessions
          .slice(0, 2)
          .map((session) => session.title)
          .join(' and ')}.`
      : 'The next useful step is to keep logging completed sessions so the review has enough signal.';

  return `${completionText}, ${volumeText}. ${trendText} ${keyText}`;
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-1 text-sm leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-500">
      {children}
    </div>
  );
}

export default function CoachingDashboard({
  sessions,
  completedSessions,
  stravaActivities,
  weeklyVolume,
  stravaConnected,
  raceDate,
  initialPrompt,
}: Props) {
  const [chatOpen, setChatOpen] = useState(Boolean(initialPrompt));
  const [chatPrefill, setChatPrefill] = useState(initialPrompt ?? '');
  const [checkInRating, setCheckInRating] = useState<number | null>(null);
  const [checkInNote, setCheckInNote] = useState('');

  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const priorWeekStart = subDays(weekStart, 7);
  const priorWeekEnd = subDays(weekEnd, 7);

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
  const countdown = raceCountdown(raceDate);

  const plannedThisWeek = useMemo(() => {
    return sessions
      .filter((session) => {
        const date = safeParseDate(session.date);
        return date ? isWithinRange(date, weekStart, weekEnd) : false;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [sessions, weekStart, weekEnd]);

  const upcomingSessions = useMemo(() => {
    const lookaheadEnd = addDays(today, 10);

    return sessions
      .filter((session) => {
        const date = safeParseDate(session.date);
        return date ? isWithinRange(date, today, lookaheadEnd) && session.sport !== 'Rest' : false;
      })
      .sort((a, b) => {
        const dateCompare = String(a.date).localeCompare(String(b.date));
        if (dateCompare !== 0) return dateCompare;
        return sessionScore(b) - sessionScore(a);
      });
  }, [sessions, today]);

  const keySessions = useMemo(() => {
    const scored = upcomingSessions
      .map((session) => ({ session, score: sessionScore(session) }))
      .sort((a, b) => b.score - a.score || String(a.session.date).localeCompare(String(b.session.date)));

    const protectedSessions = scored.filter((item) => item.score >= 5).map((item) => item.session);

    return (protectedSessions.length > 0 ? protectedSessions : upcomingSessions).slice(0, 3);
  }, [upcomingSessions]);

  const completedThisWeek = useMemo(() => {
    return completedSessions.filter((row) => {
      if (row.status === 'skipped') return false;
      const date = safeParseDate(getCompletedDate(row));
      return date ? isWithinRange(date, weekStart, weekEnd) : false;
    });
  }, [completedSessions, weekStart, weekEnd]);

  const plannedMinutes = useMemo(() => {
    return plannedThisWeek.reduce((total, session) => total + sessionDurationMinutes(session), 0);
  }, [plannedThisWeek]);

  const currentWeekActivities = useMemo(() => {
    return stravaActivities.filter((activity) => {
      const date = getActivityDate(activity);
      return date ? isWithinRange(date, weekStart, weekEnd) : false;
    });
  }, [stravaActivities, weekStart, weekEnd]);

  const priorWeekActivities = useMemo(() => {
    return stravaActivities.filter((activity) => {
      const date = getActivityDate(activity);
      return date ? isWithinRange(date, priorWeekStart, priorWeekEnd) : false;
    });
  }, [stravaActivities, priorWeekStart, priorWeekEnd]);

  const actualMinutes = useMemo(() => {
    const stravaMinutes = currentWeekActivities.reduce(
      (total, activity) => total + Math.max(0, Number(activity.moving_time ?? 0) / 60),
      0
    );

    // If Strava exists, use it as the source of truth for time trained.
    if (stravaMinutes > 0) return stravaMinutes;

    return completedThisWeek.reduce((total, row) => {
      if (typeof row.duration === 'number' && Number.isFinite(row.duration)) {
        return total + row.duration;
      }

      return total + estimateDurationFromTitle(getCompletedTitle(row));
    }, 0);
  }, [currentWeekActivities, completedThisWeek]);

  const priorWeekMinutes = useMemo(() => {
    return priorWeekActivities.reduce(
      (total, activity) => total + Math.max(0, Number(activity.moving_time ?? 0) / 60),
      0
    );
  }, [priorWeekActivities]);

  const deltaMinutes = Math.round(actualMinutes - priorWeekMinutes);
  const completionPct = plannedThisWeek.length > 0 ? Math.round((completedThisWeek.length / plannedThisWeek.length) * 100) : 0;

  const sportMinutes = useMemo(() => {
    const buckets: Record<SportBucket, number> = {
      Swim: 0,
      Bike: 0,
      Run: 0,
      Strength: 0,
      Other: 0,
    };

    currentWeekActivities.forEach((activity) => {
      const sport = normalizeSport(activity.sport_type);
      buckets[sport] += Math.max(0, Number(activity.moving_time ?? 0) / 60);
    });

    if (Object.values(buckets).some((value) => value > 0)) {
      return buckets;
    }

    completedThisWeek.forEach((row) => {
      const sport = normalizeSport(row.sport);
      buckets[sport] += typeof row.duration === 'number' ? row.duration : estimateDurationFromTitle(getCompletedTitle(row));
    });

    return buckets;
  }, [currentWeekActivities, completedThisWeek]);

  const weeklyReview = buildWeeklyReview({
    completedCount: completedThisWeek.length,
    plannedCount: plannedThisWeek.length,
    actualMinutes,
    plannedMinutes,
    deltaMinutes,
    keySessions,
  });

  const openCoachWithPrompt = (prompt: string) => {
    setChatPrefill(prompt);
    setChatOpen(true);
  };

  const checkInDisabled = checkInRating === null && checkInNote.trim().length === 0;

  return (
    <main className="min-h-screen bg-[#fbfbfa] text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Coaching</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Training review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              A factual read on your week, the sessions that matter next, and the review loop your AI coach will use to guide progress.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openCoachWithPrompt('Review my current training week and tell me what matters most.')}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              Ask about this week
            </button>
            <div className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500">
              {countdown !== null ? `${countdown} days to race` : weekLabel}
            </div>
          </div>
        </header>

        <div className="mb-6">
          <StravaConnectBanner stravaConnected={stravaConnected} />
        </div>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Time trained"
            value={formatMinutes(actualMinutes)}
            detail={`${formatDelta(deltaMinutes)} · ${weekLabel}`}
          />
          <MetricTile
            label="Planned time"
            value={formatMinutes(plannedMinutes)}
            detail={`${plannedThisWeek.length} sessions scheduled this week`}
          />
          <MetricTile
            label="Sessions complete"
            value={`${completedThisWeek.length}/${plannedThisWeek.length || 0}`}
            detail={plannedThisWeek.length > 0 ? `${completionPct}% of this week` : 'No planned sessions this week'}
          />
          <MetricTile
  label="Plan to date"
  value={`${completedSessions.length}`}
  detail={`${sessions.length} planned sessions total`}
/>
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Training trends</h2>
                <p className="mt-1 text-sm text-zinc-500">Time logged by sport this week.</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                {formatMinutes(actualMinutes)}
              </span>
            </div>

            <div className="space-y-4">
              {(['Bike', 'Run', 'Swim', 'Strength', 'Other'] as SportBucket[])
                .filter((sport) => sportMinutes[sport] > 0 || sport !== 'Other')
                .map((sport) => {
                  const minutes = sportMinutes[sport];
                  const pct = actualMinutes > 0 ? Math.max(2, Math.round((minutes / actualMinutes) * 100)) : 0;

                  return (
                    <div key={sport}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${sportDotClass(sport)}`} />
                          <span className="font-medium text-zinc-800">{sport}</span>
                        </div>
                        <span className="text-zinc-500">{formatMinutes(minutes)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{ width: `${pct}%`, opacity: minutes > 0 ? 1 : 0.08 }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Weekly review</h2>
              <p className="mt-1 text-sm text-zinc-500">Generated weekly coaching review will live here.</p>
            </div>

            <p className="text-base leading-7 text-zinc-700">{weeklyReview}</p>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">Sunday check-in</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Each Sunday, rate the week and add a note. This will become the input for your AI coach review and next-week recommendations.
              </p>

              <div className="mt-4 flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setCheckInRating(rating)}
                    className={`h-9 w-9 rounded-full border text-sm font-medium transition ${
                      checkInRating === rating
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
                    }`}
                    aria-label={`Rate week ${rating} out of 5`}
                  >
                    {rating}
                  </button>
                ))}
              </div>

              <textarea
                value={checkInNote}
                onChange={(event) => setCheckInNote(event.target.value)}
                placeholder="What felt good? What felt off?"
                className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />

              <button
                type="button"
                disabled={checkInDisabled}
                onClick={() => openCoachWithPrompt(`My weekly check-in rating is ${checkInRating ?? 'not rated'}/5. Notes: ${checkInNote || 'No notes provided.'}`)}
                className="mt-3 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                Discuss this week with coach
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Key sessions</h2>
              <p className="mt-1 text-sm text-zinc-500">The next workouts most likely to shape the week.</p>
            </div>
            <span className="text-sm text-zinc-400">Next 10 days</span>
          </div>

          {keySessions.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {keySessions.map((session) => {
                const sport = normalizeSport(session.sport);
                const prompt = `Explain this key session and how I should execute it: ${session.title} on ${getSessionDateLabel(session)}.`;

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => openCoachWithPrompt(prompt)}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${sportDotClass(sport)}`} />
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">{sport}</span>
                      </div>
                      <span className="text-xs text-zinc-400">{getSessionDateLabel(session)}</span>
                    </div>
                    <p className="text-base font-semibold leading-6 text-zinc-950">{session.title}</p>
                    <p className="mt-2 text-sm leading-5 text-zinc-500">
                      {session.details || `${formatMinutes(sessionDurationMinutes(session))} planned`}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyCard>
              No upcoming key sessions found. Once your plan has sessions in the next 10 days, they will appear here.
            </EmptyCard>
          )}
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Longer trend</h2>
              <p className="mt-1 text-sm text-zinc-500">A simple view of recent training load from completed work.</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500">
              Last 30 days
            </span>
          </div>

          <FitnessPanel
            sessions={sessions}
            completedSessions={completedSessions as any}
            stravaActivities={stravaActivities}
            windowDays={30}
          />
        </section>

        <CoachChatModal open={chatOpen} onClose={() => setChatOpen(false)} prefill={chatPrefill} />
      </div>
    </main>
  );
}
