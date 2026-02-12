'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import CalendarShell from './CalendarShell';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava, { MergedSession } from '@/utils/mergeSessionWithStrava';
import Footer from '../components/footer';
import RaceHubCard from '../components/race/RaceHubCard';
import WeeklyIntentCard from '../components/race/WeeklyIntentCard';
import { calculateReadiness } from '@/lib/readiness';

// Walkthrough
import PostPlanWalkthrough from '../plan/components/PostPlanWalkthrough';
import type { WalkthroughContext } from '@/types/coachGuides';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type RaceHubState = {
  planId?: string | null;
  raceName?: string | null;
  raceLocation?: string | null;
  raceType?: string | null;
  raceDate?: string | null;
  currentPhase?: string | null;
  planPayload?: any;
};

function deriveCurrentPhase(planPayload: any): string | null {
  const weeks = planPayload?.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return null;

  const today = new Date();
  let latestPhase: string | null = null;

  for (const week of weeks) {
    if (!week?.startDate || !week?.phase) continue;
    const start = new Date(week.startDate);
    if (Number.isNaN(start.getTime())) continue;

    if (start <= today) {
      latestPhase = String(week.phase);
    }
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

export default function SchedulePage() {
  const router = useRouter();

  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';

  const [authedUserId, setAuthedUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [raceHub, setRaceHub] = useState<RaceHubState | null>(null);
  const [raceHubSaving, setRaceHubSaving] = useState(false);
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
            setRaceHub(null);
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
            setRaceHub(null);
            setLoading(false);
          }
          return;
        }

        if (userErr) throw userErr;

        if (!user) {
          if (!cancelled) {
            setAuthedUserId(null);
            setRaceHub(null);
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

        const [sessionsRes, stravaRes, completedRes, latestPlanRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
          supabase
            .from('plans')
            .select('id, race_type, race_date, plan')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (stravaRes.error) throw stravaRes.error;
        if (completedRes.error) throw completedRes.error;
        if (latestPlanRes.error) throw latestPlanRes.error;

        if (cancelled) return;

        setSessions((sessionsRes.data ?? []) as Session[]);
        setStravaActivities((stravaRes.data ?? []) as StravaActivity[]);

        const normalizedCompleted: CompletedSession[] = (completedRes.data ?? []).map((c: any) => ({
          date: c.date || c.session_date,
          session_title: c.session_title || c.title,
          strava_id: c.strava_id,
        }));

        const latestPlan = latestPlanRes.data as any;
        const params = latestPlan?.plan?.params ?? {};
        setRaceHub({
          planId: latestPlan?.id ?? null,
          raceType: latestPlan?.race_type ?? null,
          raceDate: latestPlan?.race_date ?? null,
          raceName: params?.raceName ?? null,
          raceLocation: params?.raceLocation ?? null,
          currentPhase: deriveCurrentPhase(latestPlan?.plan),
          planPayload: latestPlan?.plan ?? null,
        });

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

  const handleRaceHubSave = useCallback(
    async (next: {
      raceType: string;
      raceDate: string;
      raceName?: string;
      raceLocation?: string;
    }) => {
      if (!authedUserId || !raceHub?.planId) {
        return { ok: false, message: 'No active plan found yet. Generate a plan first.' };
      }

      try {
        setRaceHubSaving(true);

        const basePlan = raceHub?.planPayload && typeof raceHub.planPayload === 'object' ? raceHub.planPayload : {};
        const nextParams = {
          ...(basePlan as any).params,
          raceName: next.raceName?.trim() || null,
          raceLocation: next.raceLocation?.trim() || null,
        };

        const { error } = await supabase
          .from('plans')
          .update({
            race_type: next.raceType,
            race_date: next.raceDate,
            plan: {
              ...(basePlan as any),
              params: nextParams,
            },
          })
          .eq('id', raceHub.planId)
          .eq('user_id', authedUserId);

        if (error) throw error;

        setRaceHub((prev) =>
          prev
            ? {
                ...prev,
                raceType: next.raceType,
                raceDate: next.raceDate,
                raceName: next.raceName?.trim() || null,
                raceLocation: next.raceLocation?.trim() || null,
                planPayload: {
                  ...(basePlan as any),
                  params: nextParams,
                },
              }
            : prev
        );

        return { ok: true, message: 'Saved' };
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Failed to save race details.' };
      } finally {
        setRaceHubSaving(false);
      }
    },
    [authedUserId, raceHub]
  );

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

  const weeklyIntent = useMemo(() => {
    const { start, end } = getWeekBounds();
    const rangeLabel = formatWeekRange(start, end);

    const weekSessions = sessions
      .filter((session) => {
        const d = new Date(session.date);
        return !Number.isNaN(d.getTime()) && d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const hardSessions = weekSessions.filter((s) => /tempo|threshold|interval|long|brick|race pace/i.test(s.title || ''));
    const keySessions = (hardSessions.length ? hardSessions : weekSessions).slice(0, 3);

    const bullets = keySessions.length
      ? keySessions.map((s) => `${s.sport}: ${s.title}`)
      : ['Set your race and generate a plan to see this week’s key focus sessions.'];

    const keySessionTitles = keySessions.map((s) => `${s.sport}: ${s.title}`);
    const prefill = keySessionTitles.length
      ? `Weekly coaching check-in for ${rangeLabel}. My top sessions are: ${keySessionTitles.join('; ')}.`
      : `Weekly coaching check-in for ${rangeLabel}. Help me plan my key sessions.`;

    return {
      weekRangeLabel: rangeLabel,
      bullets,
      coachingHref: `/coaching?q=${encodeURIComponent(prefill)}`,
    };
  }, [sessions]);

  const readiness = useMemo(
    () =>
      calculateReadiness({
        sessions,
        completedSessions,
        raceDate: raceHub?.raceDate,
      }),
    [sessions, completedSessions, raceHub?.raceDate]
  );

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
          <>
            <div className="mx-auto w-full max-w-7xl px-4 pb-4">
              <RaceHubCard
                raceName={raceHub?.raceName}
                raceLocation={raceHub?.raceLocation}
                raceType={raceHub?.raceType}
                raceDate={raceHub?.raceDate}
                currentPhase={raceHub?.currentPhase}
                readinessScore={readiness.score}
                readinessLabel={readiness.label}
                raceHubHref="/race"
                saving={raceHubSaving}
                onSave={handleRaceHubSave}
              />

              <WeeklyIntentCard
                weekRangeLabel={weeklyIntent.weekRangeLabel}
                phase={raceHub?.currentPhase}
                bullets={weeklyIntent.bullets}
                ctaHref={weeklyIntent.coachingHref}
                ctaLabel="Open weekly coaching"
              />
            </div>

            <div className="relative left-1/2 w-screen -translate-x-1/2">
              <CalendarShell
                sessions={enrichedSessions}
                completedSessions={completedSessions}
                extraStravaActivities={unmatchedActivities}
                onCompletedUpdate={handleCompletedUpdate}
                timezone={userTimezone}
                onOpenWalkthrough={openWalkthrough}
                walkthroughLoading={walkthroughLoading}
              />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
