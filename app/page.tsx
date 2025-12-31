'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

function ScreenshotCard({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label?: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {label ? (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-900">{label}</div>
          <div className="text-xs text-gray-500">Live product</div>
        </div>
      ) : null}
      <div className="relative w-full aspect-[9/16] bg-gray-50">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}

function Section({
  kicker,
  title,
  desc,
  children,
  flip = false,
}: {
  kicker?: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className={flip ? 'lg:col-span-6 lg:order-2' : 'lg:col-span-6'}>
          {kicker ? (
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
              {kicker}
            </div>
          ) : null}
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 leading-tight">
            {title}
          </h2>
          <p className="mt-3 text-lg text-gray-600 leading-relaxed">
            {desc}
          </p>
        </div>

        <div className={flip ? 'lg:col-span-6 lg:order-1' : 'lg:col-span-6'}>
          {children}
        </div>
      </div>
    </section>
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
      {/* Background */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[520px] w-[980px] rounded-full bg-gray-100 blur-3xl opacity-70" />
          <div className="absolute top-24 right-[-140px] h-[320px] w-[320px] rounded-full bg-gray-100 blur-3xl opacity-60" />
          <div className="absolute top-56 left-[-160px] h-[320px] w-[320px] rounded-full bg-gray-100 blur-3xl opacity-60" />
        </div>

        <main className="relative max-w-6xl mx-auto px-6 pt-16 pb-8">
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
                Pick your race, your date, and your weekly hours. Get a complete plan you can follow on mobile, and generate detailed workouts when you want them.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push(primaryCta.href)}
                  className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                >
                  {primaryCta.label}
                </button>

                <button
                  onClick={() => router.push(secondaryCta.href)}
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

            {/* Hero screenshot: mobile week list */}
            <div className="lg:col-span-6">
              <ScreenshotCard
                src="/landing/mobile-week.png"
                alt="Mobile weekly schedule screenshot"
                label="Your plan, week by week"
              />
            </div>
          </div>

          {/* Minimal divider */}
          <div className="mt-14 border-t border-gray-200" />
        </main>
      </div>

      {/* HOW IT WORKS */}
      <div id="how-it-works" className="max-w-6xl mx-auto px-6">
        <Section
          kicker="Magic moment"
          title="Turn any session into a detailed workout instantly."
          desc="Start with a high-level plan. When you want more precision, generate a complete workout with one tap."
          flip
        >
          <ScreenshotCard
            src="/landing/mobile-workout.png"
            alt="Detailed workout modal screenshot"
            label="Detailed workout generation"
          />
        </Section>

        <div className="border-t border-gray-200" />

        <Section
          kicker="Progress tracking"
          title="Sync with Strava and track what you actually did."
          desc="Pull in completed workouts and compare planned versus completed training over time."
        >
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Progress dashboard</div>
              <div className="text-xs text-gray-500">Strava connected</div>
            </div>
            <div className="relative w-full aspect-[16/10] bg-gray-50">
              <Image
                src="/landing/dashboard.png"
                alt="Coaching dashboard screenshot"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </Section>

        <div className="border-t border-gray-200" />

        {/* Final CTA */}
        <section className="py-14">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Get your plan in seconds.
              </h3>
              <p className="mt-2 text-gray-600">
                Free to start. Generate your plan, then add detailed workouts when you want more structure.
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
                onClick={() => router.push('/schedule')}
                className="bg-white text-gray-900 px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-50 border border-gray-200 w-full md:w-auto"
              >
                Explore the calendar
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Optional: keep blog preview, but it is below the CTA */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
