'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import CalendarShell from './CalendarShell';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava, { MergedSession } from '@/utils/mergeSessionWithStrava';
import Footer from '../components/footer';

// Walkthrough
import PostPlanWalkthrough from '../plan/components/PostPlanWalkthrough';
import type { WalkthroughContext } from '@/types/coachGuides';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

export default function SchedulePage() {
  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Walkthrough state
  const [walkthroughContext, setWalkthroughContext] = useState<WalkthroughContext | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughLoading, setWalkthroughLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        const [sessionsRes, stravaRes, completedRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (stravaRes.error) throw stravaRes.error;
        if (completedRes.error) throw completedRes.error;

        if (cancelled) return;

        setSessions((sessionsRes.data ?? []) as Session[]);
        setStravaActivities((stravaRes.data ?? []) as StravaActivity[]);

        const normalizedCompleted: CompletedSession[] = (completedRes.data ?? []).map((c: any) => ({
          date: c.date || c.session_date,
          session_title: c.session_title || c.title,
          strava_id: c.strava_id,
        }));

        setCompletedSessions(normalizedCompleted);
        setLoading(false);
      } catch (e: any) {
        console.error('SchedulePage fetchData error:', e);
        if (!cancelled) {
          setLoadError(e?.message ?? 'Failed to load schedule data.');
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCompletedUpdate = useCallback((updated: CompletedSession[]) => {
    setCompletedSessions(updated);
  }, []);

  const { enrichedSessions, unmatchedActivities } = useMemo(() => {
    try {
      const { merged, unmatched } = mergeSessionsWithStrava(sessions, stravaActivities, userTimezone);
      return { enrichedSessions: merged, unmatchedActivities: unmatched };
    } catch (e) {
      console.error('mergeSessionsWithStrava failed:', e);
      return {
        enrichedSessions: sessions as unknown as MergedSession[],
        unmatchedActivities: [] as StravaActivity[],
      };
    }
  }, [sessions, stravaActivities, userTimezone]);

  const isLoggedOut = enrichedSessions.length === 0 && stravaActivities.length === 0;

  const fetchLatestPlanContext = useCallback(async (): Promise<WalkthroughContext | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return null;

    const { data: latestPlan, error: planErr } = await supabase
      .from('plans')
      .select('id, user_id, race_type, race_date, experience, max_hours, rest_day')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planErr) return null;
    if (!latestPlan?.id || !latestPlan?.user_id) return null;

    return {
      planId: String(latestPlan.id),
      userId: String(latestPlan.user_id),
      raceType: (latestPlan as any).race_type ?? null,
      raceDate: (latestPlan as any).race_date ? String((latestPlan as any).race_date) : null,
      experience: (latestPlan as any).experience ?? null,
      maxHours: (latestPlan as any).max_hours != null ? Number((latestPlan as any).max_hours) : null,
      restDay: (latestPlan as any).rest_day ?? null,
      // keep whatever your WalkthroughContext expects
      mode: 'manual' as any,
    };
  }, []);

  const openWalkthrough = useCallback(async () => {
    try {
      setWalkthroughLoading(true);

      if (walkthroughContext?.planId) {
        setWalkthroughContext({ ...walkthroughContext, mode: 'manual' as any });
        setWalkthroughOpen(true);
        return;
      }

      const ctx = await fetchLatestPlanContext();

      if (!ctx) {
        console.warn('[Walkthrough] No plan context found for user.');
        return;
      }

      setWalkthroughContext(ctx);
      setWalkthroughOpen(true);
    } finally {
      setWalkthroughLoading(false);
    }
  }, [fetchLatestPlanContext, walkthroughContext]);

  if (loading) {
    return <div className="text-center py-10 text-zinc-400">Loading your training data...</div>;
  }

  if (loadError) {
    return (
      <div className="text-center py-10 text-zinc-400">
        <div className="text-sm">Something went wrong loading your schedule.</div>
        <div className="mt-2 text-xs text-zinc-500">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ✅ IMPORTANT: only mount the walkthrough when open so it cannot intercept taps */}
      {walkthroughOpen && (
        <PostPlanWalkthrough
          context={walkthroughContext}
          open={walkthroughOpen}
          onClose={() => setWalkthroughOpen(false)}
        />
      )}

      <main className="flex-grow">
        {isLoggedOut ? (
          <div className="text-center py-10 text-zinc-400">Please sign in to view your schedule.</div>
        ) : (
          <div className="w-full">
  {/* Top-right actions row (full width, but padded) */}
  <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-3 flex items-center justify-end">
    <button
      type="button"
      onClick={openWalkthrough}
      disabled={walkthroughLoading}
      className="text-sm px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50"
    >
      {walkthroughLoading ? 'Opening…' : 'Walkthrough'}
    </button>
  </div>

  {/* Calendar is full-bleed; it manages its own padding */}
  <CalendarShell
    sessions={enrichedSessions}
    completedSessions={completedSessions}
    stravaActivities={stravaActivities}
    extraStravaActivities={unmatchedActivities}
    onCompletedUpdate={handleCompletedUpdate}
    timezone={userTimezone}
  />
</div>

        )}
      </main>

      <Footer />
    </div>
  );
}
