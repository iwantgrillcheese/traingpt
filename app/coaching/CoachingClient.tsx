'use client';

import { useEffect, useMemo, useState } from 'react';
import CoachingDashboard from '../components/CoachingDashboard';
import type { Session as PlannedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { getWeeklySummary, type WeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';
import { supabase } from '@/lib/supabase-client';
import { useStravaAutoSync } from '../hooks/useStravaAutoSync';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';

type CompletedSessionRow = {
  id?: string;
  user_id: string;

  // older rows / code paths
  date?: string;
  session_date?: string;

  session_title?: string;
  title?: string;

  strava_id?: string | number | null;
  sport?: string | null;
  duration?: number | null;
};

function normalizeCompletedRows(rows: CompletedSessionRow[]) {
  return rows.map((r) => ({
    ...r,
    // canonical fields expected elsewhere
    session_date: r.session_date ?? r.date ?? undefined,
    session_title: r.session_title ?? r.title ?? undefined,
    strava_id: r.strava_id != null ? String(r.strava_id) : undefined,
  }));
}

export default function CoachingClient() {
  useStravaAutoSync();

  const [userId, setUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<PlannedSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSessionRow[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);

  const [stravaConnected, setStravaConnected] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep auth state in sync (fixes “Auth session missing” in prod on first paint)
  useEffect(() => {
    let cancelled = false;

    async function bootstrapUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error) {
        console.warn('[CoachingClient] getUser error:', error);
        setUserId(null);
        return;
      }

      setUserId(user?.id ?? null);
    }

    bootstrapUser();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: SupabaseSession | null) => {
        if (cancelled) return;
        setUserId(session?.user?.id ?? null);
      }
    );

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Fetch coaching data whenever we have a userId
  useEffect(() => {
    let cancelled = false;

    async function fetchAll(uid: string) {
      try {
        setLoading(true);
        setLoadError(null);

        const [sessionsRes, completedRes, stravaRes, profileRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', uid),
          supabase.from('completed_sessions').select('*').eq('user_id', uid),
          supabase.from('strava_activities').select('*').eq('user_id', uid),
          supabase.from('profiles').select('strava_access_token').eq('id', uid).single(),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (completedRes.error) throw completedRes.error;
        if (stravaRes.error) throw stravaRes.error;
        if (profileRes.error) {
          // don’t hard fail the page if profile lookup fails
          console.warn('[CoachingClient] profiles lookup failed:', profileRes.error);
        }

        if (cancelled) return;

        const fetchedSessions = (sessionsRes.data ?? []) as PlannedSession[];
        const fetchedCompleted = normalizeCompletedRows(
          (completedRes.data ?? []) as CompletedSessionRow[]
        );
        const fetchedStrava = (stravaRes.data ?? []) as StravaActivity[];

        setSessions(fetchedSessions);
        setCompletedSessions(fetchedCompleted);
        setStravaActivities(fetchedStrava);
        setStravaConnected(!!profileRes.data?.strava_access_token);
      } catch (err: any) {
        console.error('[CoachingClient] fetch error', err);
        if (!cancelled) setLoadError(err?.message || 'Failed to load coaching data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!userId) {
      // Not logged in (or session hasn’t hydrated yet)
      setLoading(false);
      return;
    }

    fetchAll(userId);

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Compute weekly stats locally
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

  if (!userId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Auth session missing! Please sign in again.
        </div>
      </div>
    );
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

  if (!weeklySummary) return null;

  return (
    <CoachingDashboard
      userId={userId}
      sessions={sessions}
      completedSessions={completedSessions as any}
      stravaActivities={stravaActivities}
      weeklyVolume={weeklyVolume}
      weeklySummary={weeklySummary}
      stravaConnected={stravaConnected}
    />
  );
}
