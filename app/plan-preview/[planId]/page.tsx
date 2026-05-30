'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { track } from '@/lib/analytics/posthog-client';

type PlanRow = {
  id: string;
  race_type: string | null;
  race_date: string | null;
  plan: any;
  created_at?: string | null;
};

type PreviewSession = {
  date: string;
  label: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(value?: string | null) {
  if (!value) return 'Race date set in your plan';

  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function sessionToLabel(session: any): string {
  if (typeof session === 'string') return session;

  const sport = typeof session?.sport === 'string' ? session.sport : '';
  const title = typeof session?.title === 'string' ? session.title : '';
  const duration = typeof session?.duration === 'string' ? session.duration : '';
  const intensity = typeof session?.intensity === 'string' ? session.intensity : '';

  return [sport, title, duration, intensity].filter(Boolean).join(' • ') || 'Training session';
}

function extractPreviewSessions(plan: any): PreviewSession[] {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const firstWeekWithSessions = weeks.find((week: any) => {
    const days = week?.days;
    return days && typeof days === 'object' && Object.values(days).some((sessions) => Array.isArray(sessions) && sessions.length > 0);
  });

  if (!firstWeekWithSessions?.days) return [];

  return Object.entries(firstWeekWithSessions.days)
    .flatMap(([date, sessions]) =>
      Array.isArray(sessions)
        ? sessions.slice(0, 2).map((session) => ({ date, label: sessionToLabel(session) }))
        : []
    )
    .slice(0, 6);
}

function summarizeWeeklyVolume(plan: any) {
  const maxHours = Number(plan?.params?.maxHours);
  if (!Number.isFinite(maxHours) || maxHours <= 0) return 'Built around your weekly availability';

  const low = Math.max(1, Math.round(maxHours * 0.65));
  const high = Math.round(maxHours);
  return `${low}–${high} hours per week`;
}

function uniquePhases(plan: any): string[] {
  const phases = (Array.isArray(plan?.weeks) ? plan.weeks : [])
    .map((week: any) => (typeof week?.phase === 'string' ? week.phase.trim() : ''))
    .filter((phase: string): phase is string => Boolean(phase));

  return Array.from(new Set<string>(phases)).slice(0, 5);
}

export const dynamic = 'force-dynamic';

export default function PlanPreviewPage() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams?.get('checkout');
  const planId = params?.planId;

  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingActive, setBillingActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace(`/login?next=${encodeURIComponent(`/plan-preview/${planId}`)}`);
          return;
        }

        const [planRes, profileRes] = await Promise.all([
          supabase
            .from('plans')
            .select('id, race_type, race_date, plan, created_at')
            .eq('id', planId)
            .eq('user_id', session.user.id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('stripe_subscription_active')
            .eq('id', session.user.id)
            .maybeSingle(),
        ]);

        if (planRes.error) throw planRes.error;
        if (profileRes.error) throw profileRes.error;

        if (!planRes.data) {
          router.replace('/plan');
          return;
        }

        const active = Boolean((profileRes.data as any)?.stripe_subscription_active);

        if (!cancelled) {
          setPlan(planRes.data as PlanRow);
          setBillingActive(active);
        }

        if (active) {
          router.replace('/schedule?upgraded=true');
          return;
        }

        track('plan_preview_viewed', {
          plan_id: planId,
          race_type: (planRes.data as any)?.race_type,
          checkout_status: checkoutStatus ?? null,
        });
      } catch (err: any) {
        console.error('[plan-preview] load failed', err);
        if (!cancelled) setError(err?.message ?? 'Could not load your plan preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (planId) load();

    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, planId, router]);

  const phases = useMemo(() => uniquePhases(plan?.plan), [plan?.plan]);
  const phaseLabels = phases.length ? phases : ['Base', 'Build', 'Peak', 'Taper'];
  const previewSessions = useMemo(() => extractPreviewSessions(plan?.plan), [plan?.plan]);
  const weekCount = Array.isArray(plan?.plan?.weeks) ? plan?.plan?.weeks.length : 0;
  const weeklyVolume = summarizeWeeklyVolume(plan?.plan);
  const raceType = plan?.race_type || plan?.plan?.params?.raceType || 'Custom training plan';
  const raceDate = plan?.race_date || plan?.plan?.params?.raceDate || null;

  const handleSubscribe = useCallback(async () => {
    if (!planId) return;

    try {
      setSubscribing(true);
      setError(null);

      track('plan_preview_unlock_clicked', {
        plan_id: planId,
        race_type: raceType,
      });

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || 'Could not start checkout. Please try again.');
      }

      window.location.href = json.url;
    } catch (err: any) {
      console.error('[plan-preview] checkout failed', err);
      setError(err?.message ?? 'Could not start checkout. Please try again.');
      setSubscribing(false);
    }
  }, [planId, raceType]);

  if (loading || billingActive) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-[#f7f5f0] px-6 pt-24">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          <p className="text-sm font-medium text-zinc-500">Preparing your plan preview...</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-[#f7f5f0] px-6 pt-24">
        <div className="max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-zinc-950">Couldn’t load your preview.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/plan')}
            className="mt-6 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Back to plan builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {checkoutStatus === 'success' ? (
          <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Payment received. We’re confirming your subscription now — refresh in a moment if your schedule does not open automatically.
          </div>
        ) : null}

        {checkoutStatus === 'cancelled' ? (
          <div className="mb-5 rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600">
            Checkout was cancelled. Your plan preview is still saved here.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">Your plan is ready</p>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                Unlock your personalized training calendar.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500">
                Built around your race date, weekly availability, current experience, and training preferences. No generic PDF. Your schedule is ready to train from.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Race</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">{raceType}</p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Date</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">{formatDate(raceDate)}</p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Build</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">{weekCount ? `${weekCount} weeks` : 'Structured build'}</p>
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {phaseLabels.map((phase, index) => (
                    <React.Fragment key={`${phase}-${index}`}>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700">
                        {phase}
                      </span>
                      {index < phaseLabels.length - 1 ? <span className="text-zinc-300">→</span> : null}
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-500">
                  Weekly volume: <span className="font-medium text-zinc-800">{weeklyVolume}</span>. Includes swim, bike, run, recovery, long sessions, and race-specific progression.
                </p>
              </div>
            </div>

            <aside className="border-t border-zinc-200 bg-zinc-950 p-7 text-white sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm font-medium text-white/60">TrainGPT Plus</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-semibold tracking-[-0.05em]">$5</span>
                  <span className="pb-2 text-sm font-medium text-white/55">/ month</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/60">
                  Unlock your full calendar, detailed workouts, Strava-connected schedule, and ongoing plan access. Cancel anytime.
                </p>

                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {subscribing ? 'Opening checkout...' : 'Unlock TrainGPT Plus'}
                </button>

                <p className="mt-4 text-center text-xs leading-5 text-white/40">
                  Secure checkout through Stripe. Your plan is already saved.
                </p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-white/70">
                {['Full schedule calendar', 'Plan regeneration access', 'Detailed session generation', 'Strava-connected training view'].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Preview</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">A sample from your first training week</h2>
            </div>
            <p className="text-sm text-zinc-500">Full calendar unlocks after checkout.</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(previewSessions.length ? previewSessions : [
              { date: 'Week 1', label: 'Aerobic endurance session' },
              { date: 'Week 1', label: 'Technique-focused swim' },
              { date: 'Week 1', label: 'Long ride progression' },
            ]).map((session, index) => (
              <div
                key={`${session.date}-${session.label}-${index}`}
                className={cx(
                  'rounded-3xl border border-zinc-200 bg-zinc-50 p-4',
                  index > 2 ? 'hidden sm:block' : ''
                )}
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">{session.date}</p>
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-zinc-900">{session.label}</p>
              </div>
            ))}
          </div>

          {error ? <p className="mt-5 text-sm text-rose-600">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
