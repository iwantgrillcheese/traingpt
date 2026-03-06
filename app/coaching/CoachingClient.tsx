'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CoachingDashboard from '../components/CoachingDashboard';
import type { Session as TrainSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { getWeeklySummary, type WeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';
import { supabase } from '@/lib/supabase-client';
import { useStravaAutoSync } from '../hooks/useStravaAutoSync';
import { decodeCoachingContext } from '@/lib/coaching/context';
import type { CoachingContextPayload } from '@/types/coaching-context';

type CompletedSessionRow = {
  id?: string;
  user_id: string;

  // older rows / code paths
  date?: string;
  session_date?: string;

  session_title?: string;
  title?: string;

  strava_id?: string | number | null;
};

type NormalizedCompletedSession = CompletedSessionRow & {
  session_date?: string;
  session_title?: string;
  strava_id?: string;
};

function normalizeCompletedRows(rows: CompletedSessionRow[]): NormalizedCompletedSession[] {
  return rows.map((r) => ({
    ...r,
    session_date: r.session_date ?? r.date ?? undefined,
    session_title: r.session_title ?? r.title ?? undefined,
    strava_id: r.strava_id != null ? String(r.strava_id) : undefined,
  }));
}

export default function CoachingClient() {
  useStravaAutoSync();
  const searchParams = useSearchParams();

  const initialPrompt = searchParams?.get('q') ?? '';
  const initialContext: CoachingContextPayload | null = useMemo(
    () => decodeCoachingContext(searchParams?.get('ctx')),
    [searchParams]
  );

  const [userId, setUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<TrainSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<NormalizedCompletedSession[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [raceDate, setRaceDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function fetchAll(attempt = 0) {
      try {
        setLoading(true);
        setLoadError(null);

        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;

        if (!session?.user) {
          if (!cancelled) {
            setUserId(null);
            setSessions([]);
            setCompletedSessions([]);
            setStravaActivities([]);
            setStravaConnected(false);
            setLoading(false);
          }
          return;
        }

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        const msg = userErr?.message?.toLowerCase() ?? '';
        if (msg.includes('auth session missing') && attempt < 1) {
          await sleep(350);
          return fetchAll(attempt + 1);
        }

        if (userErr) throw userErr;

        if (!user) {
          if (!cancelled) {
            setUserId(null);
            setSessions([]);
            setCompletedSessions([]);
            setStravaActivities([]);
            setStravaConnected(false);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;
        setUserId(user.id);

        const [sessionsRes, completedRes, stravaRes, profileRes, latestPlanRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
          supabase.from('profiles').select('strava_access_token').eq('id', user.id).single(),
          supabase
            .from('plans')
            .select('race_date')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (completedRes.error) throw completedRes.error;
        if (stravaRes.error) throw stravaRes.error;
        if (latestPlanRes.error) throw latestPlanRes.error;

        if (profileRes.error) {
          // don’t hard fail the whole page if profile lookup flakes
          console.warn('[CoachingClient] profiles lookup failed:', profileRes.error);
        }

        if (cancelled) return;

        setSessions((sessionsRes.data ?? []) as TrainSession[]);
        setCompletedSessions(normalizeCompletedRows((completedRes.data ?? []) as CompletedSessionRow[]));
        setStravaActivities((stravaRes.data ?? []) as StravaActivity[]);
        setStravaConnected(!!profileRes.data?.strava_access_token);
        setRaceDate((latestPlanRes.data as any)?.race_date ?? null);
      } catch (err: unknown) {
        console.error('[CoachingClient] fetch error', err);
        const msg =
          err instanceof Error ? err.message : 'Failed to load coaching data.';
        if (!cancelled) setLoadError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, []);

  const weeklySummary: WeeklySummary | null = useMemo(() => {
    if (!userId) return null;
    return getWeeklySummary(sessions, completedSessions as any, stravaActivities);
  }, [userId, sessions, completedSessions, stravaActivities]);

  const weeklyVolume: number[] = useMemo(() => {
    if (!userId) return [];
    return getWeeklyVolume(sessions, completedSessions as any, stravaActivities);
  }, [userId, sessions, completedSessions, stravaActivities]);

  if (loading) {
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

  if (!userId) {
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
    <CoachingDashboard
      userId={userId}
      sessions={sessions}
      completedSessions={completedSessions as any}
      stravaActivities={stravaActivities}
      weeklyVolume={weeklyVolume}
      weeklySummary={weeklySummary}
      stravaConnected={stravaConnected}
      raceDate={raceDate}
      initialPrompt={initialPrompt}
      initialContext={initialContext}
    />
  );
}
