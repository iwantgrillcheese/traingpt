// CoachingDashboard.tsx
'use client';

import { useMemo, useState } from 'react';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import CompliancePanel from '@/app/coaching/CompliancePanel';
import WeeklySummaryPanel from '@/app/coaching/WeeklySummaryPanel';
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
}: Props) {
const [chatOpen, setChatOpen] = useState(false);
const [chatPrefill, setChatPrefill] = useState<string>('');
  const [windowKey, setWindowKey] = useState<WindowKey>('L30');
  const [showDetails, setShowDetails] = useState(false);

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

  // A simple “fitness score” header value: we’ll let FitnessPanel be the source of truth later.
  // For tonight: show a neutral trend signal derived from time volume change.
  const fitnessTrend = useMemo(() => {
    if (Math.abs(deltaMinutes) < 30) return { label: 'Stable', tone: 'neutral' as const };
    if (deltaMinutes > 0) return { label: 'Trending up', tone: 'up' as const };
    return { label: 'Trending down', tone: 'down' as const };
  }, [deltaMinutes]);

  const coachActions = [
    { id: 'stall', title: 'Why did my fitness stall?', subtitle: 'Diagnose volume, intensity, recovery.' },
    { id: 'focus', title: 'What should I focus on next?', subtitle: 'One clear priority for the next block.' },
    { id: 'balance', title: 'Is my training balanced?', subtitle: 'Sport mix + consistency check.' },
  ] as const;

  return (
    <div className="relative mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <StravaConnectBanner stravaConnected={stravaConnected} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900">Performance</h2>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{label}</span>
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-gray-500">Window</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right"
            title="Score based on adherence, consistency, and race proximity."
          >
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Readiness</div>
            <div className="text-sm font-semibold text-gray-900">{readiness.score}/100 · {readiness.label}</div>
          </div>

          {/* Mobile primary action */}
          <button
            onClick={() => {
              setChatPrefill('');
              setChatOpen(true);
            }}
            className="md:hidden inline-flex items-center justify-center rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
          >
            Ask coach
          </button>
        </div>


      </div>

      {/* Window selector + KPI row */}
      <div className="mt-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-1">
            {(['L7', 'L30', 'L90', 'M6', 'Y1'] as WindowKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setWindowKey(k)}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition',
                  k === windowKey
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {windowLabel(k)}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-500">
            {format(start, 'MMM d')} → {format(end, 'MMM d')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Training time</div>
            <div className="mt-1 text-base font-semibold text-gray-900">{formatMinutes(completedMinutes)}</div>
            <div className="mt-1 text-xs text-gray-500">{deltaLabel}</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Sessions</div>
            <div className="mt-1 text-base font-semibold text-gray-900">{completedCount}</div>
            <div className="mt-1 text-xs text-gray-500">{plannedCount} planned</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Consistency</div>
            <div
              className={clsx(
                'mt-1 text-base font-semibold',
                adherencePct >= 85 ? 'text-gray-900' : adherencePct >= 60 ? 'text-gray-900' : 'text-gray-900'
              )}
            >
              {adherencePct}%
            </div>
            <div className="mt-1 text-xs text-gray-500">of planned time</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Fitness</div>
            <div className="mt-1 text-base font-semibold text-gray-900">{fitnessTrend.label}</div>
            <div
              className={clsx(
                'mt-1 text-xs',
                fitnessTrend.tone === 'up'
                  ? 'text-emerald-700'
                  : fitnessTrend.tone === 'down'
                  ? 'text-rose-700'
                  : 'text-gray-500'
              )}
            >
              Based on training load change
            </div>
          </div>
        </div>
      </div>

      {/* HERO: FitnessPanel */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Fitness trend</h3>
            <p className="mt-1 text-xs text-gray-500">
              Uses completed Strava sessions when available.
            </p>
          </div>

          {/* Desktop coach entry */}
          <button
  onClick={() => {
    setChatPrefill('');
    setChatOpen(true);
  }}
  className="hidden md:inline-flex items-center rounded-full border border-gray-200 bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
>
  Ask coach
</button>


        </div>

        <div className="mt-4">
          <FitnessPanel
  sessions={sessions}
  completedSessions={completedSessions as any}
  stravaActivities={stravaActivities}
  windowDays={WINDOW_DAYS[windowKey]}
/>

        </div>

        {/* Coach actions (replaces chat box UI) */}
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {coachActions.map((a) => (
            <button
              key={a.id}
              onClick={() => {
  setChatPrefill(a.title);
  setChatOpen(true);
}}
              className="group rounded-2xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 transition"
            >
              <div className="text-sm font-semibold text-gray-900">{a.title}</div>
              <div className="mt-1 text-xs text-gray-500">{a.subtitle}</div>
              <div className="mt-3 inline-flex items-center text-xs font-medium text-gray-700 group-hover:text-gray-900">
                Open analysis <span className="ml-1">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Secondary: Details (collapsed) */}
      <div className="mt-6">
        <button
          onClick={() => setShowDetails((s) => !s)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
        >
          <div>
            <div className="text-sm font-semibold text-gray-900">Training details</div>
            <div className="mt-0.5 text-xs text-gray-500">
              Consistency + weekly recap (optional)
            </div>
          </div>
          <div className="text-sm text-gray-500">{showDetails ? '–' : '+'}</div>
        </button>

        {showDetails ? (
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <WeeklySummaryPanel weeklySummary={weeklySummary} viewMode="week" />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <CompliancePanel weeklySummary={weeklySummary} viewMode="week" />
            </div>
          </div>
        ) : null}
      </div>
      

      <CoachChatModal
  open={chatOpen}
  onClose={() => setChatOpen(false)}
  prefill={chatPrefill}
/>

    </div>
  );
}
