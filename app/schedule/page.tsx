'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import CalendarShell from './CalendarShell';
import PostPlanWalkthrough from '../plan/components/PostPlanWalkthrough';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useStravaAutoSync } from '../hooks/useStravaAutoSync';
import { track } from '@/lib/analytics/posthog-client';

import type { Session, CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { WalkthroughContext } from '@/types/coachGuides';
import mergeSessionsWithStrava, { type MergedSession } from '@/utils/mergeSessionWithStrava';

import {
  conciseSessionLabel,
  formatSessionDateLabel,
  formatWeekPhaseHeader,
  getNextUpcomingSession,
  getTodaysPrimarySession,
} from './session-utils';

type RaceHubState = {
  planId?: string | null;
  raceName?: string | null;
  raceLocation?: string | null;
  raceType?: string | null;
  raceDate?: string | null;
  currentPhase?: string | null;
  planPayload?: any;
};

type DataWindow = {
  start: Date;
  end: Date;
  startDateKey: string;
  endDateKey: string;
  startIso: string;
  endIso: string;
};

const STRAVA_COLUMNS = [
  'id',
  'user_id',
  'strava_id',
  'name',
  'sport_type',
  'start_date',
  'start_date_local',
  'moving_time',
  'distance',
  'manual',
  'created_at',
  'average_heartrate',
  'max_heartrate',
  'average_speed',
  'average_watts',
  'weighted_average_watts',
  'kilojoules',
  'total_elevation_gain',
  'device_watts',
  'trainer',
].join(',');

function deriveCurrentPhase(planPayload: any): string | null {
  const weeks = planPayload?.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return null;

  const today = new Date();
  let latestPhase: string | null = null;

  for (const week of weeks) {
    if (!week?.startDate || !week?.phase) continue;

    const start = parseDateValue(week.startDate);
    if (!start) continue;

    if (start <= today) latestPhase = String(week.phase);
  }

  return latestPhase ?? (weeks[0]?.phase ? String(weeks[0].phase) : null);
}

function getWeekBounds(reference = new Date()) {
  const start = new Date(reference);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;

  start.setDate(start.getDate() + offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekRange(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function parseDateValue(value?: string | null): Date | null {
  if (!value) return null;

  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildScheduleDataWindow(sessions: Session[], raceDate?: string | null): DataWindow {
  const today = new Date();

  const parsedSessionDates = sessions
    .map((session) => parseDateValue(session.date))
    .filter((date): date is Date => !!date);

  let start: Date;
  let end: Date;

  if (parsedSessionDates.length > 0) {
    start = new Date(Math.min(...parsedSessionDates.map((date) => date.getTime())));
    end = new Date(Math.max(...parsedSessionDates.map((date) => date.getTime())));

    // Small buffer catches Strava activities near plan edges and manual status edits.
    start.setDate(start.getDate() - 14);
    end.setDate(end.getDate() + 14);
  } else {
    start = new Date(today);
    start.setDate(today.getDate() - 90);

    end = new Date(today);
    end.setDate(today.getDate() + 30);
  }

  const parsedRaceDate = parseDateValue(raceDate);
  if (parsedRaceDate && parsedRaceDate > end) {
    end = new Date(parsedRaceDate);
    end.setDate(end.getDate() + 14);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    startDateKey: toDateKey(start),
    endDateKey: toDateKey(end),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function normalizeCompletedSessions(rows: any[]): CompletedSession[] {
  return (rows ?? [])
    .map((c: any): CompletedSession => ({
      date: String(c.date || c.session_date || ''),
      session_title: String(c.session_title || c.title || ''),
      status: c.status === 'skipped' ? 'skipped' : 'done',
    }))
    .filter((row): row is CompletedSession => Boolean(row.date && row.session_title));
}

export default function SchedulePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const scheduleViewTrackedRef = useRef(false);
  const loadRunRef = useRef(0);

  const userTimezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles'
      : 'America/Los_Angeles';

  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [raceHub, setRaceHub] = useState<RaceHubState | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const stravaSync = useStravaAutoSync({
    enabled: Boolean(user?.id),
    onSyncComplete: () => setReloadToken((value: number) => value + 1),
  });

  const [walkthroughContext, setWalkthroughContext] = useState<WalkthroughContext | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughLoading, setWalkthroughLoading] = useState(false);
  const [autoWalkthroughFired, setAutoWalkthroughFired] = useState(false);
  const [shouldAutoOpenWalkthrough, setShouldAutoOpenWalkthrough] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setShouldAutoOpenWalkthrough(sp.get('walkthrough') === '1');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const clearScheduleState = () => {
      setAuthedUserId(null);
      setSessions([]);
      setStravaActivities([]);
      setCompletedSessions([]);
      setRaceHub(null);
    };

    const loadSchedule = async () => {
      if (authLoading) return;

      const runId = ++loadRunRef.current;

      try {
        if (!cancelled && runId === loadRunRef.current) {
          setLoading(true);
          setLoadError(null);
        }

        if (!user?.id) {
          clearScheduleState();
          return;
        }

        setAuthedUserId(user.id);

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        });

        if (profileError) {
          // Non-fatal. The schedule can still render.
          console.error('[schedule] profile upsert failed:', profileError);
        }

        const { data: latestPlanRow, error: latestPlanError } = await supabase
          .from('plans')
          .select('id, race_type, race_date, plan')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPlanError) throw latestPlanError;

        const latestPlan = latestPlanRow as any;
        const latestPlanId = latestPlan?.id ?? null;

        const sessionsQuery = latestPlanId
          ? supabase
              .from('sessions')
              .select('*')
              .eq('user_id', user.id)
              .eq('plan_id', latestPlanId)
              .order('date', { ascending: true })
          : supabase
              .from('sessions')
              .select('*')
              .eq('user_id', user.id)
              .order('date', { ascending: true });

        const sessionsRes = await sessionsQuery;

        if (sessionsRes.error) throw sessionsRes.error;

        const loadedSessions = (sessionsRes.data ?? []) as Session[];
        const dataWindow = buildScheduleDataWindow(loadedSessions, latestPlan?.race_date ?? null);

        const [stravaRes, completedRes] = await Promise.all([
          supabase
            .from('strava_activities')
            .select(STRAVA_COLUMNS)
            .eq('user_id', user.id)
            .gte('start_date', dataWindow.startIso)
            .lte('start_date', dataWindow.endIso)
            .order('start_date', { ascending: false })
            .limit(500),

          supabase
            .from('completed_sessions')
            .select('date, session_title, status')
            .eq('user_id', user.id)
            .gte('date', dataWindow.startDateKey)
            .lte('date', dataWindow.endDateKey)
            .order('date', { ascending: false })
            .limit(1000),
        ]);

        if (stravaRes.error) throw stravaRes.error;
        if (completedRes.error) throw completedRes.error;

        if (cancelled || runId !== loadRunRef.current) return;

        const params = latestPlan?.plan?.params ?? {};

        setSessions(loadedSessions);
        setStravaActivities((stravaRes.data ?? []) as StravaActivity[]);
        setCompletedSessions(normalizeCompletedSessions(completedRes.data ?? []));
        setRaceHub({
          planId: latestPlan?.id ?? null,
          raceType: latestPlan?.race_type ?? null,
          raceDate: latestPlan?.race_date ?? null,
          raceName: params?.raceName ?? null,
          raceLocation: params?.raceLocation ?? null,
          currentPhase: deriveCurrentPhase(latestPlan?.plan),
          planPayload: latestPlan?.plan ?? null,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log('[schedule] loaded', {
            userId: user.id,
            planId: latestPlanId,
            sessions: loadedSessions.length,
            stravaActivities: stravaRes.data?.length ?? 0,
            completedSessions: completedRes.data?.length ?? 0,
            dataWindow: {
              start: dataWindow.startDateKey,
              end: dataWindow.endDateKey,
            },
          });
        }
      } catch (error: any) {
        console.error('[schedule] load failed:', error);

        if (!cancelled && runId === loadRunRef.current) {
          setLoadError(error?.message ?? 'Failed to load schedule data.');
        }
      } finally {
        if (!cancelled && runId === loadRunRef.current) {
          setLoading(false);
        }
      }
    };

    loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, reloadToken]);

  useEffect(() => {
    if (loading || !authedUserId || scheduleViewTrackedRef.current) return;

    const width = window.innerWidth;
    const view = width < 768 ? 'mobile' : width < 1100 ? 'month' : 'desktop';

    track('schedule_viewed', { view });
    scheduleViewTrackedRef.current = true;
  }, [loading, authedUserId]);

  const handleCompletedUpdate = useCallback((updated: CompletedSession[]) => {
    setCompletedSessions(updated);
  }, []);

  const { enrichedSessions, unmatchedActivities } = useMemo(() => {
    try {
      const { merged, unmatched } = mergeSessionsWithStrava(
        sessions,
        stravaActivities,
        userTimezone
      );

      return {
        enrichedSessions: merged,
        unmatchedActivities: unmatched,
      };
    } catch (error) {
      console.error('[schedule] mergeSessionsWithStrava failed:', error);

      return {
        enrichedSessions: sessions as unknown as MergedSession[],
        unmatchedActivities: [] as StravaActivity[],
      };
    }
  }, [sessions, stravaActivities, userTimezone]);

  const scheduleSummary = useMemo(() => {
    const todayPrimary = getTodaysPrimarySession(enrichedSessions as any, new Date());
    const nextUpcoming = getNextUpcomingSession(enrichedSessions as any, new Date());
    const { start, end } = getWeekBounds();
    const weekRange = formatWeekRange(start, end);

    return {
      weekPhase: formatWeekPhaseHeader(weekRange, raceHub?.currentPhase ?? null),
      todayLabel: todayPrimary
        ? `${conciseSessionLabel(todayPrimary.title, todayPrimary.sport)} • ${formatSessionDateLabel(todayPrimary.date)}`
        : 'No workout scheduled today',
      nextLabel: nextUpcoming
        ? `${conciseSessionLabel(nextUpcoming.title, nextUpcoming.sport)} • ${formatSessionDateLabel(nextUpcoming.date)}`
        : 'No upcoming sessions yet',
    };
  }, [enrichedSessions, raceHub?.currentPhase]);

  const fetchLatestPlanContext = useCallback(async (): Promise<WalkthroughContext | null> => {
    if (!user?.id) return null;

    const { data: latestPlan, error } = await supabase
      .from('plans')
      .select('id, user_id, race_type, race_date, experience, max_hours, rest_day')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !latestPlan?.id || !latestPlan?.user_id) return null;

    return {
      planId: String(latestPlan.id),
      userId: String(latestPlan.user_id),
      raceType: (latestPlan as any).race_type ?? null,
      raceDate: (latestPlan as any).race_date ? String((latestPlan as any).race_date) : null,
      experience: (latestPlan as any).experience ?? null,
      maxHours: (latestPlan as any).max_hours != null ? Number((latestPlan as any).max_hours) : null,
      restDay: (latestPlan as any).rest_day ?? null,
      mode: 'manual' as any,
    };
  }, [user?.id]);

  const openWalkthrough = useCallback(async () => {
    try {
      setWalkthroughLoading(true);

      const ctx = await fetchLatestPlanContext();
      if (!ctx) return;

      setWalkthroughContext(ctx);
      setWalkthroughOpen(true);
    } finally {
      setWalkthroughLoading(false);
    }
  }, [fetchLatestPlanContext]);

  useEffect(() => {
    if (!shouldAutoOpenWalkthrough) return;
    if (autoWalkthroughFired) return;
    if (loading) return;
    if (!authedUserId) return;

    setAutoWalkthroughFired(true);

    const run = async () => {
      const ctx = await fetchLatestPlanContext();

      if (ctx) {
        setWalkthroughContext({ ...(ctx as any), mode: 'auto' });
      }

      setWalkthroughOpen(true);

      try {
        window.history.replaceState({}, '', '/schedule');
      } catch {
        router.replace('/schedule');
      }
    };

    run();
  }, [
    shouldAutoOpenWalkthrough,
    autoWalkthroughFired,
    loading,
    authedUserId,
    fetchLatestPlanContext,
    router,
  ]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-white px-6 pt-24">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          <p className="text-sm font-medium text-zinc-500">Loading your training data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-white px-6 pt-24">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-zinc-900">Couldn’t load your schedule.</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{loadError}</p>

          <button
            type="button"
            onClick={() => setReloadToken((n: number) => n + 1)}
            className="mt-5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!authedUserId) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-white px-6 pt-24">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-zinc-900">Sign in to view your schedule.</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Your training calendar is connected to your TrainGPT account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {walkthroughOpen && (
        <PostPlanWalkthrough
          context={walkthroughContext}
          open={walkthroughOpen}
          onClose={() => setWalkthroughOpen(false)}
        />
      )}

      {stravaSync.message ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              stravaSync.status === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : stravaSync.status === 'syncing'
                  ? 'border-zinc-200 bg-white text-zinc-600'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {stravaSync.message}
          </div>
        </div>
      ) : null}

      <main className="flex-grow">
        <CalendarShell
            sessions={enrichedSessions}
            completedSessions={completedSessions}
            extraStravaActivities={unmatchedActivities}
            onCompletedUpdateAction={handleCompletedUpdate}
            timezone={userTimezone}
            onOpenWalkthroughAction={openWalkthrough}
            walkthroughLoading={walkthroughLoading}
            todaySummary={scheduleSummary.todayLabel}
            nextSummary={scheduleSummary.nextLabel}
            weekPhaseSummary={scheduleSummary.weekPhase}
            raceGoal={raceHub?.raceType ?? raceHub?.raceName ?? null}
          />
      </main>
    </div>
  );
}
