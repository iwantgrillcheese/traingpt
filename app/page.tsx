'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

type CtaAction = {
  label: string;
  kind: 'login' | 'schedule' | 'plan';
};

function Reveal({
  children,
  className = '',
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={[
        'transition-all duration-700 ease-out will-change-transform',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function TopNav({
  authed,
  onPrimary,
  onSecondary,
}: {
  authed: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const shellClass = scrolled
    ? 'bg-white/80 border-b border-gray-200/70 backdrop-blur-xl'
    : 'bg-transparent border-b border-transparent';

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${shellClass}`}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="inline-flex items-center gap-3"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-900 text-xs font-semibold text-white">
            T
          </span>
          <span className="text-sm font-semibold tracking-tight text-gray-900">TrainGPT</span>
        </button>

        <div className="hidden items-center gap-1 md:flex">
          {['System', 'Strava', 'Workflows', 'Resources'].map((item) => (
            <button
              key={item}
              className="rounded-full px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSecondary}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            {authed ? 'Open calendar' : 'Log in'}
          </button>
          <button
            onClick={onPrimary}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            {authed ? 'Continue' : 'Get started'}
          </button>
        </div>
      </div>
    </header>
  );
}

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-gray-200/80 bg-white/90 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-gray-900">{value}</div>
    </div>
  );
}

function SystemCard({
  title,
  body,
  index,
}: {
  title: string;
  body: string;
  index: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-700/80 bg-gray-900/70 p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-gray-400">{index}</div>
      <h3 className="mt-4 text-lg font-semibold text-gray-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">{body}</p>
    </div>
  );
}

function DetailRow({ day, session, note }: { day: string; session: string; note: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-4 border-b border-gray-200 py-4 last:border-b-0">
      <div className="text-sm font-medium text-gray-500">{day}</div>
      <div>
        <div className="text-sm font-medium text-gray-900">{session}</div>
        <div className="mt-1 text-sm text-gray-600">{note}</div>
      </div>
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

      setHasPlan(Boolean(planData?.id));
    };

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error) {
        console.warn('[home] getSession error', error);
      }

      const nextSession = data.session ?? null;
      setSession(nextSession);
      setAuthReady(true);

      if (nextSession?.user?.id) {
        await loadPlanFlag(nextSession.user.id);
      } else {
        setHasPlan(false);
      }
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;

      setSession(nextSession ?? null);
      setAuthReady(true);

      if (nextSession?.user?.id) {
        loadPlanFlag(nextSession.user.id);
      } else {
        setHasPlan(false);
      }
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

  const ctas = useMemo(() => {
    if (session && hasPlan) {
      return {
        primary: { label: 'Open schedule', kind: 'schedule' } as CtaAction,
        secondary: { label: 'Review plan', kind: 'plan' } as CtaAction,
      };
    }

    if (session && !hasPlan) {
      return {
        primary: { label: 'Create your plan', kind: 'plan' } as CtaAction,
        secondary: { label: 'Open schedule', kind: 'schedule' } as CtaAction,
      };
    }

    return {
      primary: { label: 'Get started', kind: 'login' } as CtaAction,
      secondary: { label: 'Log in', kind: 'login' } as CtaAction,
    };
  }, [session, hasPlan]);

  const runAction = (action: CtaAction) => {
    if (action.kind === 'login') {
      router.push('/login');
      return;
    }

    if (action.kind === 'schedule') {
      router.push('/schedule');
      return;
    }

    router.push('/plan');
  };

  const authed = Boolean(session);

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-gray-900">
      <TopNav
        authed={authed}
        onPrimary={() => runAction(ctas.primary)}
        onSecondary={() => runAction(ctas.secondary)}
      />

      <main className="pt-16">
        <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-b from-[#eef2f7] to-[#f8fafc]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(148,163,184,0.24),transparent_50%),radial-gradient(circle_at_80%_35%,rgba(148,163,184,0.18),transparent_45%)]" />

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:py-24 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Reveal>
                <div className="inline-flex items-center rounded-full border border-gray-300 bg-white/80 px-3 py-1 text-xs font-medium text-gray-600">
                  AI coaching for triathletes, built like a premium training desk
                </div>
                <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-gray-900 md:text-6xl">
                  The tastefully minimal training system that keeps athletes consistent.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
                  TrainGPT combines race-specific planning, calendar-first execution, and Strava-backed tracking in one calm, focused workspace.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => runAction(ctas.primary)}
                    className="rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                  >
                    {authReady ? ctas.primary.label : 'Loading...'}
                  </button>
                  <button
                    onClick={() => runAction(ctas.secondary)}
                    className="rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                  >
                    {authReady ? ctas.secondary.label : 'Preparing'}
                  </button>
                </div>
              </Reveal>

              <Reveal delayMs={120} className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Workflow" value="Plan → Calendar → Review" />
                <Stat label="Sync" value="Strava-ready" />
                <Stat label="Design" value="Quiet + focused" />
              </Reveal>
            </div>

            <div className="lg:col-span-5">
              <Reveal delayMs={140}>
                <GlassPanel className="space-y-5">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Today</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">Bike endurance · 75 min</div>
                    <p className="mt-2 text-sm text-gray-600">Warmup 15 min Z2 · 3 × 6 min tempo · Cooldown 10 min easy spin.</p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Compliance</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full w-[74%] rounded-full bg-gray-700" />
                    </div>
                    <div className="mt-2 text-sm text-gray-600">74% complete this week · synced from Strava.</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-xs text-gray-500">Planned sessions</div>
                      <div className="mt-1 text-xl font-semibold text-gray-900">9</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-xs text-gray-500">Completed</div>
                      <div className="mt-1 text-xl font-semibold text-gray-900">7</div>
                    </div>
                  </div>
                </GlassPanel>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="border-b border-gray-200 bg-[#0f172a] py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-400">The system</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Not just a plan generator — a full execution loop.
              </h2>
            </Reveal>

            <Reveal delayMs={100} className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SystemCard
                index="01"
                title="Plan with intent"
                body="Generate race-aligned weekly structure around your available training time."
              />
              <SystemCard
                index="02"
                title="Execute on calendar"
                body="See every session in a clean schedule and keep the next workout obvious."
              />
              <SystemCard
                index="03"
                title="Sync with Strava"
                body="Match completed activities to planned sessions for automatic compliance tracking."
              />
              <SystemCard
                index="04"
                title="Dial in details"
                body="Generate warmup, main set, and cooldown when you need workout specificity."
              />
            </Reveal>
          </div>
        </section>

        <section className="border-b border-gray-200 bg-white py-16 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Reveal>
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">How it works</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
                  Built for athletes who prefer calm clarity over noisy dashboards.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-600">
                  Every interaction is tuned for quick orientation: what today requires, what this week looks like, and how execution compares to the plan.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delayMs={80}>
                <GlassPanel>
                  <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Sample training week</div>
                  <div className="mt-3">
                    <DetailRow
                      day="Mon"
                      session="Swim · 45 min recovery"
                      note="Technique focus and breathing rhythm reset after long run weekend."
                    />
                    <DetailRow
                      day="Wed"
                      session="Run · Threshold intervals"
                      note="Structured set with auto-generated paces and recoveries."
                    />
                    <DetailRow
                      day="Sat"
                      session="Bike · Long aerobic"
                      note="Strava upload auto-matches and updates planned vs completed."
                    />
                  </div>
                </GlassPanel>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="bg-[#f8fafc] py-14">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
            <Reveal>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
                Make training feel premium, focused, and sustainable.
              </h3>
              <p className="mt-2 text-gray-600">Build your plan in minutes and keep execution sharp all season.</p>
            </Reveal>
            <Reveal delayMs={110}>
              <button
                onClick={() => runAction(ctas.primary)}
                className="rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                {authReady ? ctas.primary.label : 'Loading...'}
              </button>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-6">
          <Reveal>
            <BlogPreview />
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
