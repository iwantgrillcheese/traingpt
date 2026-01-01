'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';

  const [authedUserId, setAuthedUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Walkthrough state
  const [walkthroughContext, setWalkthroughContext] = useState<WalkthroughContext | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughLoading, setWalkthroughLoading] = useState(false);

  // Auto-open control (one-shot)
  const [autoWalkthroughFired, setAutoWalkthroughFired] = useState(false);
  const [shouldAutoOpenWalkthrough, setShouldAutoOpenWalkthrough] = useState(false);

  // Read query param WITHOUT useSearchParams (Next 15 build-safe)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setShouldAutoOpenWalkthrough(sp.get('walkthrough') === '1');
    } catch {
      setShouldAutoOpenWalkthrough(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const load = async (attempt: number) => {
      try {
        setLoading(true);
        setLoadError(null);

        // 1) Get session first (more stable during hydration).
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (!session || sessionErr) {
          if (!cancelled) {
            setAuthedUserId(null);
            setSessions([]);
            setStravaActivities([]);
            setCompletedSessions([]);
            setLoading(false);
          }
          return;
        }

        // 2) Now fetch user (can throw transient "Auth session missing" right after redirect on mobile).
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        const msg = userErr?.message?.toLowerCase() ?? '';
        if (msg.includes('auth session missing')) {
          if (attempt < 1) {
            await sleep(400);
            return load(attempt + 1);
          }
          if (!cancelled) {
            setAuthedUserId(null);
            setLoading(false);
          }
          return;
        }

        if (userErr) throw userErr;

        if (!user) {
          if (!cancelled) {
            setAuthedUserId(null);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;

        setAuthedUserId(user.id);

        // ✅ Ensure profile row exists (safe to call after any login)
        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        });

        if (upsertError) {
          console.error('Failed to upsert profile:', upsertError);
          // Don't block schedule load
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
        console.error('SchedulePage load error:', e);
        if (!cancelled) {
          setLoadError(e?.message ?? 'Failed to load schedule data.');
          setLoading(false);
        }
      }
    };

    load(0);

    // If auth finishes hydrating after first render, reload.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load(0);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
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

  const isLoggedOut = !authedUserId;

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
      mode: 'manual' as any,
    };
  }, []);

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

  // Auto-open walkthrough if ?walkthrough=1 (one-time), then clean URL
  useEffect(() => {
    if (!shouldAutoOpenWalkthrough) return;
    if (autoWalkthroughFired) return;

    if (loading) return;
    if (!authedUserId) return;

    setAutoWalkthroughFired(true);

    (async () => {
      const ctx = await fetchLatestPlanContext();
      if (ctx) setWalkthroughContext({ ...(ctx as any), mode: 'auto' });
      setWalkthroughOpen(true);

      // Clean URL without triggering Next searchParams
      try {
        window.history.replaceState({}, '', '/schedule');
      } catch {
        router.replace('/schedule');
      }
    })();
  }, [
    shouldAutoOpenWalkthrough,
    autoWalkthroughFired,
    loading,
    authedUserId,
    fetchLatestPlanContext,
    router,
  ]);

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
    <div className="flex min-h-screen flex-col bg-white">
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
          <CalendarShell
            sessions={enrichedSessions}
            completedSessions={completedSessions}
            stravaActivities={stravaActivities}
            extraStravaActivities={unmatchedActivities}
            onCompletedUpdate={handleCompletedUpdate}
            timezone={userTimezone}
            onOpenWalkthrough={openWalkthrough}
            walkthroughLoading={walkthroughLoading}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
