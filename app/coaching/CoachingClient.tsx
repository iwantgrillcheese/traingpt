'use client';

import { useEffect, useMemo, useState } from 'react';
import CoachingDashboard from '../components/CoachingDashboard';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { getWeeklySummary, type WeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';
import { supabase } from '@/utils/supabaseClient';
import { useStravaAutoSync } from '../hooks/useStravaAutoSync';

type CompletedSession = {
  id?: string;
  user_id: string;

  // depending on older rows / code paths you had
  date?: string;
  session_date?: string;

  session_title?: string;
  title?: string;

  strava_id?: string | number | null;
};

function normalizeCompletedRows(rows: CompletedSession[]) {
  return rows.map((r) => ({
    ...r,
    // prefer canonical fields the rest of the app expects
    session_date: r.session_date ?? r.date ?? undefined,
    session_title: r.session_title ?? r.title ?? undefined,
    strava_id: r.strava_id != null ? String(r.strava_id) : undefined,
  }));
}

export default function CoachingClient() {
  useStravaAutoSync(); // ✅ Auto-trigger Strava sync on load

  const [userId, setUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);

  const [stravaConnected, setStravaConnected] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        setLoading(true);
        setLoadError(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

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

        const [sessionsRes, completedRes, stravaRes, profileRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
          supabase.from('profiles').select('strava_access_token').eq('id', user.id).single(),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (completedRes.error) throw completedRes.error;
        if (stravaRes.error) throw stravaRes.error;
        if (profileRes.error) {
          // don’t hard fail the page if profile lookup fails
          console.warn('profiles lookup failed:', profileRes.error);
        }

        if (cancelled) return;

        const fetchedSessions = (sessionsRes.data ?? []) as Session[];
        const fetchedCompleted = normalizeCompletedRows((completedRes.data ?? []) as CompletedSession[]);
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

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute weekly stats locally (keeps the UI refactor fast + avoids API dependency)
  const weeklySummary: WeeklySummary | null = useMemo(() => {
    if (!userId) return null;
    return getWeeklySummary(sessions, completedSessions as any, stravaActivities);
  }, [userId, sessions, completedSessions, stravaActivities]);

  const weeklyVolume: number[] = useMemo(() => {
    if (!userId) return [];
    return getWeeklyVolume(sessions, completedSessions as any, stravaActivities);
  }, [userId, sessions, completedSessions, stravaActivities]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        Loading coaching dashboard…
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

  if (!userId || !weeklySummary) return null;

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
