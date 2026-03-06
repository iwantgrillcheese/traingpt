// CoachingDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import FitnessPanel from '@/app/coaching/FitnessPanel';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';
import CoachChatModal from '@/app/components/CoachChatModal';
import {
  startOfDay,
  subDays,
  parseISO,
  isAfter,
  isBefore,
  format,
} from 'date-fns';
import clsx from 'clsx';
import { calculateReadiness } from '@/lib/readiness';
import type { CoachingContextPayload } from '@/types/coaching-context';
import { buildCoachingPrompt } from '@/lib/coaching/context';



type CompletedRow = {
  user_id?: string;
  date?: string; // legacy
  session_date?: string;
  session_title?: string;
  title?: string;
  sport?: string | null;
  duration?: number | null; // minutes (optional)
  strava_id?: string | null;
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

type WindowKey = 'L7' | 'L30' | 'L90' | 'M6' | 'Y1';

const WINDOW_DAYS: Record<WindowKey, number> = {
  L7: 7,
  L30: 30,
  L90: 90,
  M6: 182, // ~6 months
  Y1: 365,
};

function safeParseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function pickCompletedDate(row: CompletedRow) {
  return row.session_date ?? row.date ?? undefined;
}

const estimateDurationFromTitle = (title?: string | null): number => {
  if (!title) return 45;
  const match = title.match(/(\d{1,3}(\.\d+)?)\s*(hr|hour|hours)/i);
  if (match) {
    const hrs = parseFloat(match[1]);
    if (!Number.isNaN(hrs)) return Math.round(hrs * 60);
  }
  const matchMin = title.match(/(\d{2,3})\s*min/i);
  return matchMin ? parseInt(matchMin[1], 10) : 45;
};

const formatMinutes = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return '0 min';
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function windowLabel(key: WindowKey) {
  switch (key) {
    case 'L7':
      return 'L7';
    case 'L30':
      return 'L30';
    case 'L90':
      return 'L90';
    case 'M6':
      return '6M';
    case 'Y1':
      return '1Y';
  }
}

function rangeLabel(start: Date, end: Date) {
  // Example: Jan 1–Jan 30
  const sameYear = format(start, 'yyyy') === format(end, 'yyyy');
  const sameMonth = format(start, 'MMM') === format(end, 'MMM') && sameYear;
  if (sameMonth) return `${format(start, 'MMM d')}–${format(end, 'd')}`;
  return `${format(start, 'MMM d')}–${format(end, 'MMM d')}`;
}

export default function CoachingDashboard({
  userId,
  sessions,
  completedSessions,
  stravaActivities,
  weeklyVolume,
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

  // Window boundaries (inclusive start, inclusive end)
  const { start, end, prevStart, prevEnd } = useMemo(() => {
    const days = WINDOW_DAYS[windowKey];
    const end = startOfDay(new Date());
    const start = subDays(end, days - 1);

    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, days - 1);

    return { start, end, prevStart, prevEnd };
  }, [windowKey]);

  const label = useMemo(() => rangeLabel(start, end), [start, end]);

  // Planned sessions in window (for adherence)
  const plannedInWindow = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      const d = safeParseDate((s as any).date);
      if (!d) return false;
      const dd = startOfDay(d);
      return !isBefore(dd, start) && !isAfter(dd, end);
    });
  }, [sessions, start, end]);

  const plannedMinutes = useMemo(() => {
    return plannedInWindow.reduce((sum, s) => {
      const dur =
        (s as any).duration != null
          ? Number((s as any).duration)
          : estimateDurationFromTitle((s as any).title);
      return sum + (Number.isFinite(dur) ? dur : 0);
    }, 0);
  }, [plannedInWindow]);

  // Strava activities in window
  const stravaInWindow = useMemo(() => {
    return (stravaActivities ?? []).filter((a) => {
      const d = safeParseDate((a as any).start_date);
      if (!d) return false;
      const dd = startOfDay(d);
      return !isBefore(dd, start) && !isAfter(dd, end);
    });
  }, [stravaActivities, start, end]);

  // Completed rows in window (manual completion)
  const completedRowsInWindow: CompletedRow[] = useMemo(() => {
    const rows = (completedSessions ?? []) as CompletedRow[];
    return rows.filter((r) => {
      const d = safeParseDate(pickCompletedDate(r));
      if (!d) return false;
      const dd = startOfDay(d);
      return !isBefore(dd, start) && !isAfter(dd, end);
    });
  }, [completedSessions, start, end]);

  // Completed minutes: prefer Strava time; fallback to completed rows if Strava empty
  const completedMinutes = useMemo(() => {
    const fromStrava = stravaInWindow.reduce((sum, a) => {
      const mt = (a as any).moving_time;
      return sum + (mt != null ? mt / 60 : 0);
    }, 0);

    const fromCompletedRows = completedRowsInWindow.reduce((sum, r) => {
      const dur =
        r.duration != null && Number.isFinite(Number(r.duration))
          ? Number(r.duration)
          : estimateDurationFromTitle((r.session_title ?? r.title) as any);
      return sum + (Number.isFinite(dur) ? dur : 0);
    }, 0);

    return fromStrava > 0 ? fromStrava : fromCompletedRows;
  }, [stravaInWindow, completedRowsInWindow]);

  const plannedCount = plannedInWindow.length;
  const completedCount = useMemo(() => {
    // Count Strava activities if present; else count completed rows
    return stravaInWindow.length > 0 ? stravaInWindow.length : completedRowsInWindow.length;
  }, [stravaInWindow.length, completedRowsInWindow.length]);

  const adherencePct = useMemo(() => {
    if (plannedMinutes <= 0) return 0;
    return clampPct((completedMinutes / plannedMinutes) * 100);
  }, [plannedMinutes, completedMinutes]);

  const readiness = useMemo(
    () =>
      calculateReadiness({
        sessions,
        completedSessions,
        raceDate,
      }),
    [sessions, completedSessions, raceDate]
  );

  // Previous window for deltas
  const prevStrava = useMemo(() => {
    return (stravaActivities ?? []).filter((a) => {
      const d = safeParseDate((a as any).start_date);
      if (!d) return false;
      const dd = startOfDay(d);
      return !isBefore(dd, prevStart) && !isAfter(dd, prevEnd);
    });
  }, [stravaActivities, prevStart, prevEnd]);

  const prevCompletedMinutes = useMemo(() => {
    return prevStrava.reduce((sum, a) => {
      const mt = (a as any).moving_time;
      return sum + (mt != null ? mt / 60 : 0);
    }, 0);
  }, [prevStrava]);

  const deltaMinutes = useMemo(() => {
    return Math.round(completedMinutes - prevCompletedMinutes);
  }, [completedMinutes, prevCompletedMinutes]);

  const deltaLabel = useMemo(() => {
    if (deltaMinutes === 0) return 'No change vs prior';
    const sign = deltaMinutes > 0 ? '+' : '–';
    const abs = Math.abs(deltaMinutes);
    return `${sign}${formatMinutes(abs)} vs prior`;
  }, [deltaMinutes]);

  const contextualBrief = useMemo(() => {
    return {
      raceGoal: initialContext?.raceGoal ?? weeklySummary?.raceType ?? 'Not set',
      weekPhase: initialContext?.weekPhase ?? label,
      weekLabel: initialContext?.weekLabel ?? label,
      sessionTitle: initialContext?.sessionTitle ?? null,
      sessionDate: initialContext?.sessionDate ?? null,
      completionState: initialContext?.completionState ?? null,
      recentCompleted: initialContext?.recentCompleted ?? null,
      recentMissed: initialContext?.recentMissed ?? null,
    };
  }, [initialContext, weeklySummary, label]);

  const coachActions = [
    { id: 'explain', title: 'Explain This Workout', subtitle: 'Clarify intent and execution cues.' },
    { id: 'missed', title: 'I Missed This Session — What Should I Do?', subtitle: 'Adjust without derailing the week.' },
    { id: 'move', title: 'Can I Move This Workout?', subtitle: 'Re-sequence based on current load.' },
    { id: 'feel', title: 'How Hard Should This Feel?', subtitle: 'Set effort target and pacing cues.' },
    { id: 'focus', title: 'What Should I Focus on This Week?', subtitle: 'Define the one priority that matters.' },
  ] as const;

  const daysToRace = useMemo(() => {
    if (!raceDate) return null;
    const d = safeParseDate(raceDate);
    if (!d) return null;
    const diff = Math.ceil((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [raceDate]);

  const statusLabel = useMemo(() => {
    if (readiness.score >= 80) return 'On track';
    if (readiness.score >= 65) return 'Training well';
    if (readiness.score >= 45) return 'Watch recovery';
    if (readiness.score >= 30) return 'Needs recovery';
    return 'Low recent load';
  }, [readiness.score]);

  const primaryRecommendation = useMemo(() => {
    if (adherencePct < 60) return 'Prioritize completing planned sessions before adding intensity.';
    if (deltaMinutes < -60) return 'Use a lighter day, then resume your next key session.';
    if (deltaMinutes > 90) return 'Keep the next 2–3 days steady and protect sleep.';
    return 'Keep this rhythm and execute one key session with quality.';
  }, [adherencePct, deltaMinutes]);

  return (
    <div className="relative mt-10 rounded-2xl border border-zinc-800 bg-[#0b0d10] p-6 text-zinc-100 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <StravaConnectBanner stravaConnected={stravaConnected} />

      <section className="rounded-2xl border border-zinc-800 bg-[#101318] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Weekly Focus</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{primaryRecommendation}</h2>
            <p className="mt-2 text-sm text-zinc-400">Status: {statusLabel}</p>
          </div>
          <button
            onClick={() => {
              setChatPrefill('');
              setChatOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900/50"
          >
            Open free chat
          </button>
        </div>

        <div className="mt-5 rounded-xl bg-[#0b0d10] p-4">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Context brief</div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-zinc-300 md:grid-cols-2">
            <div><span className="text-zinc-500">Race goal:</span> {contextualBrief.raceGoal || 'Not set'}</div>
            <div><span className="text-zinc-500">Training phase:</span> {contextualBrief.weekPhase}</div>
            <div><span className="text-zinc-500">This week:</span> {contextualBrief.weekLabel}</div>
            <div><span className="text-zinc-500">Selected session:</span> {contextualBrief.sessionTitle ? `${contextualBrief.sessionTitle} (${contextualBrief.sessionDate || 'date n/a'})` : 'None selected'}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[#0b0d10] p-4">
            <div className="text-xs text-zinc-500">Plan adherence</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{adherencePct}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
              <div className="h-1.5 rounded-full bg-zinc-200" style={{ width: `${Math.min(100, adherencePct)}%` }} />
            </div>
            <div className="mt-2 text-xs text-zinc-500">{completedCount} completed · {plannedCount} planned</div>
          </div>

          <div className="rounded-xl bg-[#0b0d10] p-4">
            <div className="text-xs text-zinc-500">Weekly volume</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{formatMinutes(completedMinutes)}</div>
            <div className="mt-2 text-xs text-zinc-500">{deltaLabel}</div>
          </div>

          <div className="rounded-xl bg-[#0b0d10] p-4">
            <div className="text-xs text-zinc-500">Plan status</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{daysToRace == null ? '—' : `${Math.max(daysToRace, 0)}d`}</div>
            <div className="mt-2 text-xs text-zinc-500">to race day</div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-[#101318] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-100">Coach guidance</h3>
          <div className="inline-flex items-center rounded-full bg-[#0b0d10] p-1">
            {(['L7', 'L30', 'L90'] as WindowKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setWindowKey(k)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition',
                  k === windowKey ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {windowLabel(k)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {coachActions.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                const prompt = buildCoachingPrompt(a.title, {
                  source: 'coaching',
                  sessionId: initialContext?.sessionId,
                  sessionTitle: contextualBrief.sessionTitle,
                  sessionType: initialContext?.sessionType ?? null,
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
              className="rounded-xl bg-[#0b0d10] p-3 text-left hover:bg-[#141820] transition"
            >
              <div className="text-sm font-medium text-zinc-100">{a.title}</div>
              <div className="mt-1 text-xs text-zinc-500">{a.subtitle}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-[#101318] p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Training trend</h3>
        <p className="mt-1 text-xs text-zinc-500">Supporting visual for recent load and consistency.</p>
        <div className="mt-4">
          <FitnessPanel sessions={sessions} completedSessions={completedSessions as any} stravaActivities={stravaActivities} windowDays={WINDOW_DAYS[windowKey]} />
        </div>
      </section>

      <CoachChatModal open={chatOpen} onClose={() => setChatOpen(false)} prefill={chatPrefill} />
    </div>
  );
}
