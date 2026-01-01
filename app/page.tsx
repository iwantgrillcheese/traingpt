'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-gray-500">{hint}</div> : null}
      </div>
      <div className="shrink-0">
        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm">
          {value}
          <span className="ml-2 text-gray-400">▾</span>
        </div>
      </div>
    </div>
  );
}

function GeneratorCard({
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  onTertiary,
  tertiaryLabel,
}: {
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary: () => void;
  secondaryLabel: string;
  onTertiary?: () => void;
  tertiaryLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">Create your training plan</div>
            <div className="mt-1 text-xs text-gray-500">
              A structured triathlon plan built around your race and weekly time.
            </div>
          </div>
          {/* removed "Free to start" badge */}
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="divide-y divide-gray-100">
          <Field label="Race" value="70.3" hint="Sprint, Olympic, 70.3, Ironman" />
          <Field label="Race date" value="Sep 21, 2025" hint="Your goal day" />
          <Field label="Weekly time" value="8 hours" hint="Max available training time" />
          <Field label="Experience" value="Intermediate" hint="How long you've trained" />
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPrimary}
            className="w-full sm:w-auto bg-black text-white px-5 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
          >
            {primaryLabel}
          </button>

          <button
            onClick={onSecondary}
            className="w-full sm:w-auto bg-white text-gray-900 px-5 py-3 rounded-full text-sm font-medium hover:bg-gray-50 border border-gray-200"
          >
            {secondaryLabel}
          </button>
        </div>

        {onTertiary && tertiaryLabel ? (
          <div className="mt-3 text-sm">
            <button
              onClick={onTertiary}
              className="text-gray-500 underline underline-offset-4 hover:text-gray-900"
            >
              {tertiaryLabel}
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-gray-400" />
            Calendar view + checkoffs
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-gray-400" />
            Strava sync supported
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-gray-400" />
            Detailed workouts on demand
          </span>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="text-base font-semibold text-gray-900">{title}</div>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function MarketingHeader({
  authed,
  onLogin,
  onSchedule,
}: {
  authed: boolean;
  onLogin: () => void;
  onSchedule: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gray-900 flex items-center justify-center text-white text-[11px] font-semibold">
            T
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-gray-900">
            TrainGPT
          </span>
        </div>

        <div className="flex items-center gap-2">
          {authed ? (
            <button
              onClick={onSchedule}
              className="text-sm px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
            >
              Schedule
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="text-sm px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadPlanFlag = async (userId: string) => {
      const { data: planData, error } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.warn('[home] plan lookup error', error);
        setHasPlan(false);
        return;
      }

      setHasPlan(!!planData?.id);
    };

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) console.warn('[home] getSession error', error);

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setAuthReady(true);

        if (nextSession?.user?.id) await loadPlanFlag(nextSession.user.id);
        else setHasPlan(false);
      } catch (e) {
        if (!alive) return;
        console.warn('[home] getSession threw', e);
        setSession(null);
        setHasPlan(false);
        setAuthReady(true);
      }
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;

      setSession(s ?? null);
      setAuthReady(true);

      if (s?.user?.id) loadPlanFlag(s.user.id);
      else setHasPlan(false);
    });

    const onFocus = () => syncSession();
    window.addEventListener('focus', onFocus);

    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setAuthReady(true);
    }, 1500);

    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      window.clearTimeout(timeout);
      listener?.subscription.unsubscribe();
    };
  }, []);

  // --- NEW: compute the two-button behavior cleanly ---
  const ctas = useMemo(() => {
    if (session && hasPlan) {
      return {
        primary: { label: 'View my schedule', href: '/schedule' },
        secondary: { label: 'Re-generate my plan', href: '/plan?mode=regen' },
        tertiary: { label: 'See how it works', kind: 'scroll' as const },
      };
    }

    if (session) {
      return {
        primary: { label: 'Generate my plan', href: '/plan' },
        secondary: { label: 'See how it works', kind: 'scroll' as const },
      };
    }

    return {
      primary: { label: 'Sign in to generate your plan', href: '/login' },
      secondary: { label: 'See how it works', kind: 'scroll' as const },
    };
  }, [session, hasPlan]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-white text-gray-500">
        <div className="w-12 h-12 mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-t-black border-b-transparent animate-spin" />
        </div>
        <p className="text-sm">Checking session...</p>
      </div>
    );
  }

  const authed = !!session;

  const scrollHowItWorks = () => {
    const el = document.querySelector('#how-it-works');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrimary = () => {
    if ('href' in ctas.primary) router.push(ctas.primary.href);
  };

  const handleSecondary = () => {
    // if user has a plan, this is regen; otherwise scroll or whatever
    if ('href' in ctas.secondary) router.push((ctas.secondary as any).href);
    else scrollHowItWorks();
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ✅ Use a marketing header (no app nav) */}
      <MarketingHeader
        authed={authed}
        onLogin={() => router.push('/login')}
        onSchedule={() => router.push('/schedule')}
      />

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[980px] rounded-full bg-gray-100 blur-3xl opacity-70" />
          <div className="absolute top-24 right-[-160px] h-[360px] w-[360px] rounded-full bg-gray-100 blur-3xl opacity-60" />
          <div className="absolute top-64 left-[-180px] h-[360px] w-[360px] rounded-full bg-gray-100 blur-3xl opacity-60" />
        </div>

        <main className="relative max-w-6xl mx-auto px-6 pt-14 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
                Built for triathletes
              </div>

              <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                Generate a custom triathlon training plan in seconds.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Pick your race, your date, and your weekly hours. Get a complete plan you can follow on
                mobile — and generate detailed workouts when you want more structure.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                  Works great on mobile
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                  Strava sync supported
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                  Detailed workouts on demand
                </span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <GeneratorCard
                onPrimary={handlePrimary}
                primaryLabel={ctas.primary.label}
                onSecondary={handleSecondary}
                secondaryLabel={ctas.secondary.label}
                onTertiary={ctas.tertiary?.kind === 'scroll' ? scrollHowItWorks : undefined}
                tertiaryLabel={ctas.tertiary?.label}
              />
            </div>
          </div>

          <div className="mt-14 border-t border-gray-200" />
        </main>
      </div>

      <div id="how-it-works" className="max-w-6xl mx-auto px-6">
        <section className="py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
                How it works
              </div>
              <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 leading-tight">
                A plan you can follow — and adapt.
              </h2>
              <p className="mt-3 text-lg text-gray-600 leading-relaxed">
                Start with a high-level weekly structure. When you want more precision, generate a
                detailed workout for any session — and track what you actually did with Strava.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeatureCard
                title="Week-by-week structure"
                desc="A realistic weekly plan built around your race date, experience, and available training time."
              />
              <FeatureCard
                title="Detailed workouts on demand"
                desc="Tap any session to generate warmup, main set, and cooldown — short, structured, and specific."
              />
              <FeatureCard
                title="Calendar-first UX"
                desc="See everything at a glance, check off sessions, and keep your next workout at the top."
              />
              <FeatureCard
                title="Strava sync"
                desc="Bring in completed workouts and compare planned vs completed over time."
              />
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200" />

        <section className="py-14">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Get your plan — then refine it as you go.
              </h3>
              <p className="mt-2 text-gray-600">Start with structure. Add detail only when you want it.</p>
            </div>

            <div className="w-full md:w-auto">
              <button
                onClick={handlePrimary}
                className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800 w-full md:w-auto"
              >
                {ctas.primary.label}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-10">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
