'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CoachingDashboard from '../components/CoachingDashboard';
import CoachingCommandCenter from '../components/CoachingCommandCenter';
import type { Session as TrainSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { getWeeklySummary, type WeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useStravaAutoSync } from '../hooks/useStravaAutoSync';
import { decodeCoachingContext } from '@/lib/coaching/context';
import type { CoachingContextPayload } from '@/types/coaching-context';

type CompletedSessionRow = {
  id?: string;
  user_id: string;

  // Legacy and current row shapes.
  date?: string | null;
  session_date?: string | null;

  session_title?: string | null;
  title?: string | null;

  status?: 'done' | 'skipped' | string | null;
  duration?: number | null;
  strava_id?: string | number | null;
};

type NormalizedCompletedSession = CompletedSessionRow & {
  session_date?: string;
  session_title?: string;
  strava_id?: string;
};

type LatestPlanRow = {
  id: string | null;
  race_date: string | null;
};

const LOOKBACK_DAYS = 190;
const LOOKAHEAD_DAYS = 45;

function normalizeCompletedRows(rows: CompletedSessionRow[]): NormalizedCompletedSession[] {
  return rows.map((row) => ({
    ...row,
    session_date: row.session_date ?? row.date ?? undefined,
    session_title: row.session_title ?? row.title ?? undefined,
    strava_id: row.strava_id != null ? String(row.strava_id) : undefined,
  }));
}

function getDateWindow() {
  const now = new Date();

  const start = new Date(now);
  start.setDate(now.getDate() - LOOKBACK_DAYS);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(now.getDate() + LOOKAHEAD_DAYS);
  end.setHours(23, 59, 59, 999);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDateKey: start.toISOString().slice(0, 10),
    endDateKey: end.toISOString().slice(0, 10),
  };
}

export default function CoachingClient() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const loadRunRef = useRef(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [commandCenterPrompt, setCommandCenterPrompt] = useState<string | null>(null);

  const stravaSync = useStravaAutoSync({
    enabled: Boolean(user?.id),
    onSyncComplete: () => setReloadToken((value) => value + 1),
  });

  const initialPrompt = searchParams?.get('q') ?? '';
  const effectiveInitialPrompt = commandCenterPrompt ?? initialPrompt;
  const initialContext: CoachingContextPayload | null = useMemo(
    () => decodeCoachingContext(searchParams?.get('ctx')),
    [searchParams]
  );

  const [sessions, setSessions] = useState<TrainSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<NormalizedCompletedSession[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [raceDate, setRaceDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearData = () => {
      setSessions([]);
      setCompletedSessions([]);
      setStravaActivities([]);
      setStravaConnected(false);
      setRaceDate(null);
    };

    const fetchCoachingData = async () => {
      const runId = ++loadRunRef.current;

      if (authLoading) {
        setLoading(true);
        return;
      }

      if (!user?.id) {
        clearData();
        setLoading(false);
        setLoadError(null);
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);

        const { startIso, endIso, startDateKey, endDateKey } = getDateWindow();

        const [profileRes, latestPlanRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('strava_access_token')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('plans')
            .select('id, race_date')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (latestPlanRes.error) throw latestPlanRes.error;

        if (profileRes.error) {
          // Profile lookup should not take down coaching. It only powers the Strava banner.
          console.warn('[CoachingClient] profile lookup failed:', profileRes.error);
        }

        const latestPlan = latestPlanRes.data as LatestPlanRow | null;
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
              .gte('date', startDateKey)
              .lte('date', endDateKey)
              .order('date', { ascending: true });

        const [sessionsRes, completedRes, stravaRes] = await Promise.all([
          sessionsQuery,
          supabase
            .from('completed_sessions')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startDateKey)
            .lte('date', endDateKey)
            .order('date', { ascending: false }),
          supabase
            .from('strava_activities')
            .select('*')
            .eq('user_id', user.id)
            .gte('start_date', startIso)
            .lte('start_date', endIso)
            .order('start_date', { ascending: false })
            .limit(500),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (completedRes.error) throw completedRes.error;
        if (stravaRes.error) throw stravaRes.error;

        if (cancelled || runId !== loadRunRef.current) return;

        setSessions((sessionsRes.data ?? []) as TrainSession[]);
        setCompletedSessions(normalizeCompletedRows((completedRes.data ?? []) as CompletedSessionRow[]));
        setStravaActivities((stravaRes.data ?? []) as StravaActivity[]);
        setStravaConnected(Boolean(profileRes.data?.strava_access_token));
        setRaceDate(latestPlan?.race_date ?? null);
      } catch (err: unknown) {
        console.error('[CoachingClient] fetch error:', err);

        if (!cancelled && runId === loadRunRef.current) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load coaching data.');
        }
      } finally {
        if (!cancelled && runId === loadRunRef.current) {
          setLoading(false);
        }
      }
    };

    fetchCoachingData();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, reloadToken]);

  const weeklySummary: WeeklySummary | null = useMemo(() => {
    if (!user?.id) return null;
    return getWeeklySummary(sessions, completedSessions as any, stravaActivities);
  }, [user?.id, sessions, completedSessions, stravaActivities]);

  const weeklyVolume: number[] = useMemo(() => {
    if (!user?.id) return [];
    return getWeeklyVolume(sessions, completedSessions as any, stravaActivities);
  }, [user?.id, sessions, completedSessions, stravaActivities]);

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading coaching dashboard…</div>;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!user?.id) {
    return <div className="p-6 text-sm text-zinc-500">Please sign in to view coaching.</div>;
  }

  if (!weeklySummary) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        No coaching summary yet — generate a plan or sync workouts and refresh.
      </div>
    );
  }

  return (
    <>
      {stravaSync.message ? (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
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

      <CoachingCommandCenter
        sessions={sessions}
        completedSessions={completedSessions as any}
        stravaActivities={stravaActivities}
        stravaConnected={stravaConnected}
        raceDate={raceDate}
        onAskCoach={setCommandCenterPrompt}
      />

      <CoachingDashboard
        userId={user.id}
        sessions={sessions}
        completedSessions={completedSessions as any}
        stravaActivities={stravaActivities}
        weeklyVolume={weeklyVolume}
        weeklySummary={weeklySummary}
        stravaConnected={stravaConnected}
        raceDate={raceDate}
        initialPrompt={effectiveInitialPrompt}
        initialContext={initialContext}
      />
    </>
  );
}
