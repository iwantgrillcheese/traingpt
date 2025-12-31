'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

/**
 * A calm, premium landing page that avoids brittle product screenshots.
 * Hero shows the "generation box" (the compelling entry point) with a
 * clear CTA that routes based on auth + plan existence.
 */

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
}: {
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary: () => void;
  secondaryLabel: string;
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
          <div className="hidden sm:inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
            Free to start
          </div>
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
            Generate detailed workouts on demand
          </span>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="text-base font-semibold text-gray-900">{title}</div>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
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

  const primaryCta = useMemo(() => {
    if (session && hasPlan) return { label: 'View my schedule', href: '/schedule' };
    if (session) return { label: 'Generate my plan', href: '/plan' };
    return { label: 'Sign in to generate your plan', href: '/login' };
  }, [session, hasPlan]);

  const secondaryCta = useMemo(() => {
    if (session && hasPlan) return { label: 'Re-generate plan', href: '/plan' };
    return { label: 'See how it works', href: '#how-it-works' };
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

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Subtle background wash */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[980px] rounded-full bg-gray-100 blur-3xl opacity-70" />
          <div className="absolute top-24 right-[-160px] h-[360px] w-[360px] rounded-full bg-gray-100 blur-3xl opacity-60" />
          <div className="absolute top-64 left-[-180px] h-[360px] w-[360px] rounded-full bg-gray-100 blur-3xl opacity-60" />
        </div>

        <main className="relative max-w-6xl mx-auto px-6 pt-16 pb-10">
          {/* HERO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />
                Free to start. No credit card required.
              </div>

              <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                Generate a custom triathlon training plan in seconds.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Pick your race, your date, and your weekly hours. Get a complete plan you can follow on mobile — and
                generate detailed workouts when you want more structure.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push(primaryCta.href)}
                  className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                >
                  {primaryCta.label}
                </button>

                <button
                  onClick={() => {
                    // allow hash scroll for unauth users (and even for authed users if you want)
                    if (secondaryCta.href.startsWith('#')) {
                      const el = document.querySelector(secondaryCta.href);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      return;
                    }
                    router.push(secondaryCta.href);
                  }}
                  className="bg-white text-gray-900 px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-50 border border-gray-200"
                >
                  {secondaryCta.label}
                </button>
              </div>

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

            {/* HERO: Generation box (instead of screenshots) */}
            <div className="lg:col-span-6">
              <GeneratorCard
                onPrimary={() => router.push(primaryCta.href)}
                primaryLabel={primaryCta.label}
                onSecondary={() => {
                  const el = document.querySelector('#how-it-works');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                secondaryLabel="See how it works"
              />
            </div>
          </div>

          {/* Minimal divider */}
          <div className="mt-14 border-t border-gray-200" />
        </main>
      </div>

      {/* HOW IT WORKS */}
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
                Start with a high-level weekly structure. When you want more precision, generate a detailed workout for
                any session — and track what you actually did with Strava.
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

        {/* Final CTA */}
        <section className="py-14">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Get your plan in seconds.
              </h3>
              <p className="mt-2 text-gray-600">
                Free to start. Generate a plan you can follow — then add detail only when you want it.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                onClick={() => router.push(primaryCta.href)}
                className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800 w-full md:w-auto"
              >
                {primaryCta.label}
              </button>
              <button
                onClick={() => router.push(session ? '/schedule' : '/login')}
                className="bg-white text-gray-900 px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-50 border border-gray-200 w-full md:w-auto"
              >
                Explore the calendar
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Blog preview stays below CTA */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
