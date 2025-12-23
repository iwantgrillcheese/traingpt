// CoachingDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import CompliancePanel from '@/app/coaching/CompliancePanel';
import WeeklySummaryPanel from '@/app/coaching/WeeklySummaryPanel';
import FitnessPanel from '@/app/coaching/FitnessPanel';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';
import CoachChatModal from '@/app/components/CoachChatModal';
import {
  startOfWeek,
  addDays,
  parseISO,
  isWithinInterval,
  format,
  isAfter,
  isBefore,
} from 'date-fns';
import clsx from 'clsx';

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

const SPORT_COLORS: Record<string, string> = {
  Swim: '#60A5FA',
  Bike: '#34D399',
  Run: '#FBBF24',
  Strength: '#A78BFA',
  Unplanned: '#9CA3AF',
};

const normalizeSportName = (raw: string | null | undefined): string => {
  const sport = raw?.toLowerCase();
  switch (sport) {
    case 'swim':
      return 'Swim';
    case 'bike':
    case 'ride':
    case 'virtualride':
      return 'Bike';
    case 'run':
      return 'Run';
    case 'strength':
      return 'Strength';
    default:
      return 'Unplanned';
  }
};

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
  return hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;
};

function safeParseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function getWeekWindow(now = new Date()) {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Mon
  const weekEnd = addDays(weekStart, 6); // Sun (inclusive)
  return { weekStart, weekEnd };
}

function isInWeek(date: Date, weekStart: Date, weekEnd: Date) {
  return isWithinInterval(date, { start: weekStart, end: weekEnd });
}

function pickCompletedDate(row: CompletedRow) {
  return row.session_date ?? row.date ?? undefined;
}

function pickCompletedTitle(row: CompletedRow) {
  return row.session_title ?? row.title ?? '';
}

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: any[]; // upstream varies; we normalize defensively here
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: any;
  stravaConnected: boolean;
};

export default function CoachingDashboard({
  userId,
  sessions,
  completedSessions,
  stravaActivities,
  weeklyVolume,
  weeklySummary,
  stravaConnected,
}: Props) {
  const [chatOpen, setChatOpen] = useState(false);

  const { weekStart, weekEnd } = useMemo(() => getWeekWindow(new Date()), []);
  const weekLabel = useMemo(
    () => `${format(weekStart, 'MMM d')}–${format(weekEnd, 'MMM d')}`,
    [weekStart, weekEnd]
  );

  // Filter planned sessions to this week (Mon–Sun)
  const plannedThisWeek = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      const d = safeParseDate((s as any).date);
      return d ? isInWeek(d, weekStart, weekEnd) : false;
    });
  }, [sessions, weekStart, weekEnd]);

  // Completed rows for this week (from completed_sessions table)
  const completedRowsThisWeek: CompletedRow[] = useMemo(() => {
    const rows = (completedSessions ?? []) as CompletedRow[];
    return rows.filter((r) => {
      const d = safeParseDate(pickCompletedDate(r));
      return d ? isInWeek(d, weekStart, weekEnd) : false;
    });
  }, [completedSessions, weekStart, weekEnd]);

  // Strava activities this week
  const stravaThisWeek = useMemo(() => {
    return (stravaActivities ?? []).filter((a) => {
      const d = safeParseDate((a as any).start_date);
      return d ? isInWeek(d, weekStart, weekEnd) : false;
    });
  }, [stravaActivities, weekStart, weekEnd]);

  // Planned minutes (estimated from title or duration field if present)
  const plannedMinutes = useMemo(() => {
    return plannedThisWeek.reduce((sum, s) => {
      const dur =
        (s as any).duration != null
          ? Number((s as any).duration)
          : estimateDurationFromTitle((s as any).title);
      return sum + (Number.isFinite(dur) ? dur : 0);
    }, 0);
  }, [plannedThisWeek]);

  // Completed minutes (prefer Strava moving_time; otherwise completed row duration/title estimate)
  const completedMinutes = useMemo(() => {
    const fromStrava = stravaThisWeek.reduce((sum, a) => {
      const mt = (a as any).moving_time;
      return sum + (mt != null ? mt / 60 : 0);
    }, 0);

    const fromCompletedRows = completedRowsThisWeek.reduce((sum, r) => {
      const dur =
        (r.duration != null && Number.isFinite(Number(r.duration)))
          ? Number(r.duration)
          : estimateDurationFromTitle(pickCompletedTitle(r));
      return sum + dur;
    }, 0);

    // Avoid double counting if you already treat Strava as completion.
    // For now: count Strava time + completed row estimates ONLY if there are no Strava activities.
    // (We’ll tighten this later when matching is perfect.)
    return fromStrava > 0 ? fromStrava : fromCompletedRows;
  }, [stravaThisWeek, completedRowsThisWeek]);

  const adherencePct = useMemo(() => {
    if (plannedMinutes <= 0) return 0;
    return Math.min(100, Math.round((completedMinutes / plannedMinutes) * 100));
  }, [plannedMinutes, completedMinutes]);

  // Key sessions: detect by simple heuristics (safe v1)
  const keySessions = useMemo(() => {
    const bySport = {
      longRide: plannedThisWeek.find((s) => /long ride|long bike|endurance ride|brick/i.test((s as any).title ?? '')),
      longRun: plannedThisWeek.find((s) => /long run/i.test((s as any).title ?? '')),
      quality: plannedThisWeek.find((s) => /(tempo|threshold|interval|vo2|race pace)/i.test((s as any).title ?? '')),
    };

    const completedTitles = new Set(
      completedRowsThisWeek.map((r) => pickCompletedTitle(r)).filter(Boolean)
    );

    const completedByStrava = new Set(
      stravaThisWeek.map((a) => (a as any).name).filter(Boolean)
    );

    const isDone = (s?: Session) => {
      if (!s) return false;
      const t = String((s as any).title ?? '');
      // if you have strava_id matching later, this becomes exact.
      return completedTitles.has(t) || completedByStrava.has(t);
    };

    return {
      longRide: { session: bySport.longRide, done: isDone(bySport.longRide) },
      longRun: { session: bySport.longRun, done: isDone(bySport.longRun) },
      quality: { session: bySport.quality, done: isDone(bySport.quality) },
    };
  }, [plannedThisWeek, completedRowsThisWeek, stravaThisWeek]);

  // Next session: earliest planned session in the future (this week)
  const nextSession = useMemo(() => {
    const now = new Date();
    const upcoming = plannedThisWeek
      .map((s) => ({ s, d: safeParseDate((s as any).date) }))
      .filter((x) => x.d && (isAfter(x.d!, now) || format(x.d!, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')))
      .sort((a, b) => (a.d!.getTime() - b.d!.getTime()))[0];
    return upcoming?.s ?? null;
  }, [plannedThisWeek]);

  // Sport breakdown for THIS WEEK only (no plan-to-date toggle)
  const sportBreakdown = useMemo(() => {
    const breakdownMap = new Map<string, number>();

    // Prefer Strava for time if present this week; otherwise completed rows
    const source: any[] = (stravaThisWeek.length > 0 ? stravaThisWeek : completedRowsThisWeek) as any[];

    source.forEach((item) => {
      const sport = normalizeSportName((item as any).sport_type || (item as any).sport);
      const duration =
        'moving_time' in item && (item as any).moving_time != null
          ? (item as any).moving_time / 60
          : (item as any).duration ?? estimateDurationFromTitle((item as any).title ?? (item as any).session_title);
      breakdownMap.set(sport, (breakdownMap.get(sport) || 0) + Number(duration || 0));
    });

    return Array.from(breakdownMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((entry) => entry.value > 0);
  }, [stravaThisWeek, completedRowsThisWeek]);

  const totalTime = sportBreakdown.reduce((sum, b) => sum + b.value, 0);

  return (
    <div className="relative mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <StravaConnectBanner stravaConnected={stravaConnected} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Coaching</h2>
          <p className="mt-1 text-sm text-gray-500">
            Week of <span className="font-medium text-gray-700">{weekLabel}</span>
          </p>
        </div>

        {/* Mobile-only coach button */}
        <button
          onClick={() => setChatOpen(true)}
          className="md:hidden rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-sm"
        >
          Ask Coach
        </button>
      </div>

      {/* This Week Strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">This week</p>
          <p className="mt-1 text-sm text-gray-900">
            <span className="font-semibold">{formatMinutes(completedMinutes)}</span>{' '}
            <span className="text-gray-500">completed</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatMinutes(plannedMinutes)} planned
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">Consistency</p>
          <p className="mt-1 text-sm text-gray-900">
            <span className={clsx('font-semibold', adherencePct >= 85 ? 'text-green-700' : adherencePct >= 60 ? 'text-yellow-700' : 'text-red-700')}>
              {adherencePct}%
            </span>{' '}
            <span className="text-gray-500">of planned time</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Mon–Sun window</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">Key sessions</p>
          <div className="mt-2 space-y-1 text-sm">
            {(['longRide', 'longRun', 'quality'] as const).map((k) => {
              const label = k === 'longRide' ? 'Long ride' : k === 'longRun' ? 'Long run' : 'Quality';
              const item = (keySessions as any)[k];
              const done = item?.done;
              return (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-gray-700">{label}</span>
                  <span className={clsx('text-xs', done ? 'text-green-700' : 'text-gray-400')}>
                    {item?.session ? (done ? 'Done' : 'Planned') : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">Next up</p>
          <p className="mt-1 text-sm text-gray-900 line-clamp-2">
            {nextSession ? (nextSession as any).title : 'No more planned sessions this week'}
          </p>
          <button
            onClick={() => setChatOpen(true)}
            className="mt-2 text-xs text-gray-600 underline hover:text-gray-900"
          >
            Ask coach about this
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left column: panels */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">This week by sport</h3>
              <p className="text-xs text-gray-500">
                Total: <span className="font-medium text-gray-700">{formatMinutes(totalTime)}</span>
              </p>
            </div>

            <div className="mt-3 h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sportBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={62}
                    label={({ name, value }) => `${name}: ${formatMinutes(Number(value))}`}
                    labelLine={false}
                  >
                    {sportBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SPORT_COLORS[entry.name] ?? '#D1D5DB'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatMinutes(Number(value))}
                    labelFormatter={(label) => label}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Uses Strava time when available; otherwise estimated from completed workouts.
            </p>
          </div>

          {/* Keep existing panels + API contract */}
          <WeeklySummaryPanel weeklySummary={weeklySummary} viewMode="week" />
          <CompliancePanel weeklySummary={weeklySummary} viewMode="week" />
          <FitnessPanel sessions={sessions} completedSessions={completedSessions as any} stravaActivities={stravaActivities} />
        </div>

        {/* Right column: Coach */}
        <div className="hidden md:block md:col-span-1">
          <div className="sticky top-6 rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Your coach</h3>
              <button
                onClick={() => setChatOpen(true)}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white"
              >
                Open chat
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              Ask anything about your plan, your recent training, or a specific session.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => setChatOpen(true)}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                How is my week going?
              </button>
              <button
                onClick={() => setChatOpen(true)}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                Explain my next workout
              </button>
              <button
                onClick={() => setChatOpen(true)}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                What should I focus on next week?
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              (Coach intelligence upgrade coming next — this UI is the foundation.)
            </p>
          </div>
        </div>
      </div>

      <CoachChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
