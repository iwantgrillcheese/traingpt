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
  sport: string;
  title: string;
  description: string;
};

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

function formatShortDate(value?: string | null) {
  if (!value) return 'Week 1';

  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function normalizeSport(value: unknown) {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('swim')) return 'Swim';
  if (raw.includes('bike') || raw.includes('ride') || raw.includes('cycling')) return 'Bike';
  if (raw.includes('run')) return 'Run';
  if (raw.includes('strength') || raw.includes('gym')) return 'Strength';
  if (raw.includes('rest') || raw.includes('recovery')) return 'Recovery';
  if (raw.includes('brick')) return 'Brick';
  return 'Session';
}

function cleanTitle(value: unknown, fallback = 'Training session') {
  const raw = typeof value === 'string' ? value : '';
  const withoutEmoji = raw.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
  const firstChunk = withoutEmoji.split(/[•:|]/).map((part) => part.trim()).find(Boolean);
  const title = firstChunk || fallback;

  return title
    .replace(/^(swim|bike|run|ride|strength|brick|recovery)\s*[-–:]?\s*/i, '')
    .trim()
    .slice(0, 44) || fallback;
}

function sessionToPreview(date: string, session: any): PreviewSession {
  if (typeof session === 'string') {
    const sport = normalizeSport(session);
    return {
      date: formatShortDate(date),
      sport,
      title: cleanTitle(session, `${sport} session`),
      description: previewDescriptionForSport(sport),
    };
  }

  const sport = normalizeSport(session?.sport || session?.title || session?.type);
  return {
    date: formatShortDate(date),
    sport,
    title: cleanTitle(session?.title, `${sport} session`),
    description: previewDescriptionForSport(sport),
  };
}

function previewDescriptionForSport(sport: string) {
  switch (sport) {
    case 'Swim':
      return 'Technique and aerobic work placed around the rest of your week.';
    case 'Bike':
      return 'Progressive endurance and quality sessions built toward race demands.';
    case 'Run':
      return 'Durable, realistic run volume with easy days and race-specific work.';
    case 'Strength':
      return 'Supportive strength work designed to help you absorb training.';
    case 'Brick':
      return 'Race-specific bike-to-run practice at the right point in the week.';
    case 'Recovery':
      return 'Protected recovery so the plan stays sustainable.';
    default:
      return 'A structured session matched to your goal and availability.';
  }
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
        ? sessions.slice(0, 1).map((session) => sessionToPreview(date, session))
        : []
    )
    .filter((session) => session.sport !== 'Recovery')
    .slice(0, 4);
}

function summarizeWeeklyVolume(plan: any) {
  const maxHours = Number(plan?.params?.maxHours);
  if (!Number.isFinite(maxHours) || maxHours <= 0) return 'Matched to your weekly availability';

  const low = Math.max(1, Math.round(maxHours * 0.65));
  const high = Math.round(maxHours);
  return `${low}–${high} hrs / week`;
}

function uniquePhases(plan: any): string[] {
  const phases = (Array.isArray(plan?.weeks) ? plan.weeks : [])
    .map((week: any) => (typeof week?.phase === 'string' ? week.phase.trim() : ''))
    .filter((phase: string): phase is string => Boolean(phase));

  return Array.from(new Set<string>(phases)).slice(0, 4);
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
      <div className="flex min-h-screen items-start justify-center bg-[#f6f3ee] px-6 pt-24">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          <p className="text-sm font-medium text-zinc-500">Preparing your plan preview…</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-[#f6f3ee] px-6 pt-24">
        <div className="max-w-sm rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
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

  const defaultPreviewSessions: PreviewSession[] = [
    {
      date: 'Week 1',
      sport: 'Swim',
      title: 'Technique swim',
      description: previewDescriptionForSport('Swim'),
    },
    {
      date: 'Week 1',
      sport: 'Bike',
      title: 'Endurance ride',
      description: previewDescriptionForSport('Bike'),
    },
    {
      date: 'Week 1',
      sport: 'Run',
      title: 'Easy aerobic run',
      description: previewDescriptionForSport('Run'),
    },
  ];

  return (
    <main className="min-h-screen bg-[#f6f3ee] px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {checkoutStatus === 'success' ? (
          <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Payment received. We’re confirming your subscription now — refresh in a moment if your schedule does not open automatically.
          </div>
        ) : null}

        {checkoutStatus === 'cancelled' ? (
          <div className="mb-5 rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
            Checkout was cancelled. Your plan preview is still saved here.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[2.25rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">Plan generated</p>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.045em] text-zinc-950 sm:text-6xl">
                Your race plan is ready.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500">
                A structured training calendar built around your goal, availability, experience level, and race timeline.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ['Race', raceType],
                  ['Race date', formatDate(raceDate)],
                  ['Plan length', weekCount ? `${weekCount} weeks` : 'Structured build'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-zinc-200 bg-[#faf9f6] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
                    <p className="mt-2 text-sm font-semibold leading-5 text-zinc-950">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-[#fbfaf8] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {phaseLabels.map((phase, index) => (
                    <React.Fragment key={`${phase}-${index}`}>
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm">
                        {phase}
                      </span>
                      {index < phaseLabels.length - 1 ? <span className="text-zinc-300">→</span> : null}
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-500">
                  Planned volume: <span className="font-medium text-zinc-800">{weeklyVolume}</span>. The full calendar includes workout placement, progression, recovery, and race-specific sessions.
                </p>
              </div>
            </div>

            <aside className="bg-zinc-950 p-7 text-white sm:p-10 lg:p-12">
              <div className="flex h-full flex-col justify-between rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
                <div>
                  <p className="text-sm font-medium text-white/55">TrainGPT Plus</p>
                  <div className="mt-5 flex items-end gap-2">
                    <span className="text-6xl font-semibold tracking-[-0.06em]">$5</span>
                    <span className="pb-2 text-sm font-medium text-white/50">/ month</span>
                  </div>
                  <p className="mt-5 text-sm leading-6 text-white/60">
                    Unlock the full schedule, detailed workouts, plan regeneration, and your Strava-connected training view.
                  </p>

                  <button
                    type="button"
                    onClick={handleSubscribe}
                    disabled={subscribing}
                    className="mt-7 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {subscribing ? 'Opening checkout…' : 'Unlock full plan'}
                  </button>

                  {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
                </div>

                <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-sm text-white/68">
                  {['Full interactive calendar', 'Detailed workout generation', 'Plan regeneration access', 'Cancel anytime'].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">What unlocks</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-zinc-950">The full training system, not a static PDF.</h2>
            <div className="mt-6 space-y-4">
              {[
                ['Calendar-ready schedule', 'Every session placed across your week with recovery and key workouts balanced.'],
                ['Workout detail on demand', 'Turn a session into warmup, main set, and cooldown when you need specifics.'],
                ['Strava-connected progress', 'Bring completed workouts into the training view so your plan becomes easier to follow.'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-3xl border border-zinc-200 bg-[#faf9f6] p-4">
                  <p className="text-sm font-semibold text-zinc-950">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Preview</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-zinc-950">A cleaner glimpse of week one</h2>
              </div>
              <p className="text-sm text-zinc-500">Full details unlock after checkout.</p>
            </div>

            <div className="mt-6 space-y-3">
              {(previewSessions.length ? previewSessions : defaultPreviewSessions).map((session, index) => (
                <div
                  key={`${session.date}-${session.title}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-3xl border border-zinc-200 bg-[#faf9f6] p-4"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{session.date}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {session.sport}
                      </span>
                      <p className="text-sm font-semibold text-zinc-950">{session.title}</p>
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">{session.description}</p>
                  </div>
                  <div className="hidden rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-400 sm:block">
                    Locked
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
