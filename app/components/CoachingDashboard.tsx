'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { format, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import FitnessPanel from '@/app/coaching/FitnessPanel';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';
import CoachChatModal from '@/app/components/CoachChatModal';
import { calculateReadiness } from '@/lib/readiness';
import type { CoachingContextPayload } from '@/types/coaching-context';
import { buildCoachingPrompt } from '@/lib/coaching/context';

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
  completedSessions: any[];
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: any;
  stravaConnected: boolean;
  raceDate?: string | null;
  initialPrompt?: string;
  initialContext?: CoachingContextPayload | null;
};

type WindowKey = 'L7' | 'L30' | 'L90';

const WINDOW_DAYS: Record<WindowKey, number> = {
  L7: 7,
  L30: 30,
  L90: 90,
};

function safeParseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function pickCompletedDate(row: CompletedRow) {
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

function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(m / 60);
  const mins = m % 60;

  if (hrs <= 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function windowLabel(key: WindowKey) {
  if (key === 'L7') return '7 days';
  if (key === 'L30') return '30 days';
  return '90 days';
}

function rangeLabel(start: Date, end: Date) {
  const sameYear = format(start, 'yyyy') === format(end, 'yyyy');
  const sameMonth = format(start, 'MMM') === format(end, 'MMM') && sameYear;
  if (sameMonth) return `${format(start, 'MMM d')} – ${format(end, 'd')}`;
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
}

function raceCountdown(raceDate?: string | null) {
  if (!raceDate) return null;
  const race = safeParseDate(raceDate);
  if (!race) return null;

  const diff = Math.ceil(
    (startOfDay(race).getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, diff);
}

function getSportLabel(session?: Session | null) {
  return session?.sport ? String(session.sport) : 'Session';
}

function getDateLabel(session?: Session | null) {
  const parsed = safeParseDate(session?.date ?? null);
  return parsed ? format(parsed, 'EEE, MMM d') : 'Date not set';
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{detail}</p>
    </div>
  );
}

export default function CoachingDashboard({
  sessions,
  completedSessions,
  stravaActivities,
  weeklySummary,
  stravaConnected,
  raceDate,
  initialPrompt = '',
  initialContext = null,
}: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string>(initialPrompt);
  const [windowKey, setWindowKey] = useState<WindowKey>('L30');

  useEffect(() => {
    if (initialPrompt) setChatOpen(true);
  }, [initialPrompt]);

  const { start, end, prevStart, prevEnd } = useMemo(() => {
    const days = WINDOW_DAYS[windowKey];
    const end = startOfDay(new Date());
    const start = subDays(end, days - 1);
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, days - 1);

    return { start, end, prevStart, prevEnd };
  }, [windowKey]);

  const label = useMemo(() => rangeLabel(start, end), [start, end]);

  const plannedInWindow = useMemo(() => {
    return (sessions ?? []).filter((session) => {
      const parsed = safeParseDate((session as any).date);
      if (!parsed) return false;
      const date = startOfDay(parsed);
      return !isBefore(date, start) && !isAfter(date, end);
    });
  }, [sessions, start, end]);

  const plannedMinutes = useMemo(() => {
    return plannedInWindow.reduce((sum, session) => {
      const duration =
        (session as any).duration != null
          ? Number((session as any).duration)
          : estimateDurationFromTitle((session as any).title);
      return sum + (Number.isFinite(duration) ? duration : 0);
    }, 0);
  }, [plannedInWindow]);

  const stravaInWindow = useMemo(() => {
    return (stravaActivities ?? []).filter((activity) => {
      const parsed = safeParseDate((activity as any).start_date);
      if (!parsed) return false;
      const date = startOfDay(parsed);
      return !isBefore(date, start) && !isAfter(date, end);
    });
  }, [stravaActivities, start, end]);

  const completedRowsInWindow: CompletedRow[] = useMemo(() => {
    const rows = (completedSessions ?? []) as CompletedRow[];
    return rows.filter((row) => {
      const parsed = safeParseDate(pickCompletedDate(row));
      if (!parsed) return false;
      const date = startOfDay(parsed);
      return !isBefore(date, start) && !isAfter(date, end);
    });
  }, [completedSessions, start, end]);

  const completedMinutes = useMemo(() => {
    const fromStrava = stravaInWindow.reduce((sum, activity) => {
      const movingTime = (activity as any).moving_time;
      return sum + (movingTime != null ? Number(movingTime) / 60 : 0);
    }, 0);

    const fromCompletedRows = completedRowsInWindow.reduce((sum, row) => {
      const duration =
        row.duration != null && Number.isFinite(Number(row.duration))
          ? Number(row.duration)
          : estimateDurationFromTitle((row.session_title ?? row.title) as any);

      return sum + (Number.isFinite(duration) ? duration : 0);
    }, 0);

    return fromStrava > 0 ? fromStrava : fromCompletedRows;
  }, [stravaInWindow, completedRowsInWindow]);

  const plannedCount = plannedInWindow.length;
  const completedCount = stravaInWindow.length > 0 ? stravaInWindow.length : completedRowsInWindow.length;

  const adherencePct = useMemo(() => {
    if (plannedCount <= 0) return 0;
    return clampPct((completedCount / plannedCount) * 100);
  }, [plannedCount, completedCount]);

  const prevStrava = useMemo(() => {
    return (stravaActivities ?? []).filter((activity) => {
      const parsed = safeParseDate((activity as any).start_date);
      if (!parsed) return false;
      const date = startOfDay(parsed);
      return !isBefore(date, prevStart) && !isAfter(date, prevEnd);
    });
  }, [stravaActivities, prevStart, prevEnd]);

  const prevCompletedMinutes = useMemo(() => {
    return prevStrava.reduce((sum, activity) => {
      const movingTime = (activity as any).moving_time;
      return sum + (movingTime != null ? Number(movingTime) / 60 : 0);
    }, 0);
  }, [prevStrava]);

  const deltaMinutes = Math.round(completedMinutes - prevCompletedMinutes);
  const deltaLabel =
    deltaMinutes === 0
      ? 'No change vs prior'
      : `${deltaMinutes > 0 ? '+' : '−'}${formatMinutes(Math.abs(deltaMinutes))} vs prior`;

  const readiness = useMemo(
    () =>
      calculateReadiness({
        sessions,
        completedSessions,
        raceDate,
      }),
    [sessions, completedSessions, raceDate]
  );

  const daysToRace = raceCountdown(raceDate);

  const nextSession = useMemo(() => {
    const now = startOfDay(new Date());

    return [...(sessions ?? [])]
      .filter((session) => {
        const parsed = safeParseDate(session.date);
        if (!parsed) return false;
        return !isBefore(startOfDay(parsed), now);
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] ?? null;
  }, [sessions]);

  const contextualBrief = useMemo(() => {
    return {
      raceGoal: initialContext?.raceGoal ?? weeklySummary?.raceType ?? 'Not set',
      weekPhase: initialContext?.weekPhase ?? label,
      weekLabel: initialContext?.weekLabel ?? label,
      sessionTitle: initialContext?.sessionTitle ?? nextSession?.title ?? null,
      sessionDate: initialContext?.sessionDate ?? nextSession?.date ?? null,
      sessionType: initialContext?.sessionType ?? nextSession?.sport ?? null,
      completionState: initialContext?.completionState ?? null,
      recentCompleted: initialContext?.recentCompleted ?? null,
      recentMissed: initialContext?.recentMissed ?? null,
    };
  }, [initialContext, weeklySummary, label, nextSession]);

  const statusLabel = useMemo(() => {
    if (readiness.score >= 80) return 'On track';
    if (readiness.score >= 65) return 'Building well';
    if (readiness.score >= 45) return 'Watch recovery';
    if (readiness.score >= 30) return 'Reduce strain';
    return 'Needs consistency';
  }, [readiness.score]);

  const primaryRecommendation = useMemo(() => {
    if (plannedCount === 0) return 'Generate or update your plan so coaching has a clear target.';
    if (adherencePct < 60) return 'Focus on completing the next scheduled session before adding intensity.';
    if (deltaMinutes < -60) return 'Resume rhythm with one controlled session, then rebuild the week.';
    if (deltaMinutes > 90) return 'Protect recovery and keep the next session controlled.';
    return 'Keep the week steady and execute the next key session well.';
  }, [plannedCount, adherencePct, deltaMinutes]);

  const coachActions = [
    { id: 'week', title: 'Adjust this week', subtitle: 'Optimize the next few sessions.' },
    { id: 'explain', title: 'Explain workout', subtitle: 'Break down purpose and execution.' },
    { id: 'feel', title: "I'm feeling…", subtitle: 'Get recovery or effort guidance.' },
    { id: 'race', title: 'Race strategy', subtitle: 'Pacing, nutrition, and prep.' },
    { id: 'injury', title: 'Injury guidance', subtitle: 'Stay healthy and adapt.' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Coaching</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Coach Brief
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Actionable guidance for your week, based on your plan and completed training.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 sm:block">
            {label}
          </div>
          <button
            type="button"
            onClick={() => {
              setChatPrefill('');
              setChatOpen(true);
            }}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Ask Coach
          </button>
        </div>
      </div>

      <StravaConnectBanner stravaConnected={stravaConnected} />

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.7fr] lg:items-center">
          <div className="flex gap-5">
            <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-zinc-950 text-2xl text-white sm:flex">
              ✦
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Weekly focus
              </p>
              <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-zinc-950">
                {primaryRecommendation}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Status: {statusLabel}. {contextualBrief.raceGoal !== 'Not set' ? `Race focus: ${contextualBrief.raceGoal}.` : 'Set a race goal to make coaching more specific.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-[#fbfbfa] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Key session
            </p>
            <p className="mt-3 text-base font-semibold text-zinc-950">
              {nextSession?.title ?? 'No upcoming session'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {nextSession ? `${getDateLabel(nextSession)} · ${getSportLabel(nextSession)}` : 'Generate a plan to see what matters next.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Plan adherence"
          value={`${adherencePct}%`}
          detail={`${completedCount} completed · ${plannedCount} planned`}
        />
        <MetricCard label="Volume" value={formatMinutes(completedMinutes)} detail={deltaLabel} />
        <MetricCard
          label="Consistency"
          value={plannedCount > 0 ? `${Math.min(completedCount, plannedCount)} / ${plannedCount}` : '—'}
          detail={plannedCount > 0 ? 'Current window' : 'No sessions planned'}
        />
        <MetricCard
          label="Race countdown"
          value={daysToRace == null ? '—' : `${daysToRace}d`}
          detail={contextualBrief.raceGoal || 'Race not set'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Ask Coach</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Get help adjusting training, understanding a workout, or making a decision.
              </p>
            </div>
            <div className="hidden rounded-full bg-[#fbfbfa] p-1 sm:flex">
              {(['L7', 'L30', 'L90'] as WindowKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWindowKey(key)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition',
                    key === windowKey ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-950'
                  )}
                >
                  {windowLabel(key)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {coachActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  const prompt = buildCoachingPrompt(action.title, {
                    source: 'coaching',
                    sessionId: initialContext?.sessionId,
                    sessionTitle: contextualBrief.sessionTitle,
                    sessionType: (contextualBrief.sessionType as any) ?? null,
                    sessionDate: contextualBrief.sessionDate,
                    weekLabel: contextualBrief.weekLabel,
                    weekPhase: contextualBrief.weekPhase,
                    completionState: (contextualBrief.completionState as any) ?? 'planned',
                    recentCompleted: contextualBrief.recentCompleted ?? undefined,
                    recentMissed: contextualBrief.recentMissed ?? undefined,
                    raceGoal: contextualBrief.raceGoal,
                  });
                  setChatPrefill(prompt);
                  setChatOpen(true);
                }}
                className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-[#fbfbfa]"
              >
                <div className="text-sm font-semibold text-zinc-950">{action.title}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{action.subtitle}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setChatPrefill('What should I focus on this week?');
              setChatOpen(true);
            }}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-[#fbfbfa] px-4 py-3 text-left text-sm text-zinc-500 transition hover:border-zinc-300"
          >
            <span>Ask your coach anything…</span>
            <span className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white">Send</span>
          </button>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Coach insights</h3>
              <p className="mt-1 text-sm text-zinc-500">What stands out from your recent training.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-zinc-950" />
              <div>
                <p className="text-sm font-medium text-zinc-950">Your training rhythm is {statusLabel.toLowerCase()}.</p>
                <p className="mt-1 text-sm leading-5 text-zinc-500">{primaryRecommendation}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-zinc-300" />
              <div>
                <p className="text-sm font-medium text-zinc-950">Volume is {deltaMinutes >= 0 ? 'holding' : 'lower'} versus the prior window.</p>
                <p className="mt-1 text-sm leading-5 text-zinc-500">
                  {deltaLabel}. Use this as context, not a score to chase.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-zinc-300" />
              <div>
                <p className="text-sm font-medium text-zinc-950">Next decision: protect the key session.</p>
                <p className="mt-1 text-sm leading-5 text-zinc-500">
                  {nextSession ? `${nextSession.title} is the next clear target.` : 'Create a plan so TrainGPT can guide the week.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">Performance trend</h3>
            <p className="mt-1 text-sm text-zinc-500">Recent load and consistency from completed Strava sessions.</p>
          </div>
          <div className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500">
            {windowLabel(windowKey)}
          </div>
        </div>

        <FitnessPanel
          sessions={sessions}
          completedSessions={completedSessions as any}
          stravaActivities={stravaActivities}
          windowDays={WINDOW_DAYS[windowKey]}
        />
      </section>

      <CoachChatModal open={chatOpen} onClose={() => setChatOpen(false)} prefill={chatPrefill} />
    </div>
  );
}
