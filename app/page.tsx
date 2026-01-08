'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

/* ------------------------------ UI bits ------------------------------ */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

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
            <div className="text-sm font-semibold text-gray-900">Create your plan</div>
            <div className="mt-1 text-xs text-gray-500">
              Built around your race, your available time, and your training history.
            </div>
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
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gray-900 flex items-center justify-center text-white text-[11px] font-semibold">
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

/* ------------------------------ Bands ------------------------------ */

function BandTitle({
  eyebrow,
  title,
  desc,
  dark,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  dark?: boolean;
}) {
  return (
    <div>
      {eyebrow ? (
        <div
          className={
            dark
              ? 'inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80'
              : 'inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm'
          }
        >
          {eyebrow}
        </div>
      ) : null}

      <h2
        className={
          dark
            ? 'mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight'
            : 'mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 leading-tight'
        }
      >
        {title}
      </h2>

      {desc ? (
        <p
          className={
            dark
              ? 'mt-3 text-lg text-white/70 leading-relaxed max-w-2xl'
              : 'mt-3 text-lg text-gray-600 leading-relaxed max-w-2xl'
          }
        >
          {desc}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A “product preview” panel that feels like enterprise software.
 * Later you can swap this for a looping mp4/webm.
 */
function ProductPreviewPanel() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/30" />
          <span className="h-2 w-2 rounded-full bg-white/30" />
          <span className="h-2 w-2 rounded-full bg-white/30" />
        </div>
        <div className="text-xs text-white/60">Calendar • Plan • Strava</div>
      </div>

      {/* “fake UI” */}
      <div className="p-5">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-7">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Next up</div>
              <div className="mt-2 text-white font-semibold">Bike • 75 min • Endurance</div>
              <div className="mt-1 text-white/60 text-sm">Z2 with 3×6 min tempo</div>

              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  Planned
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  Detail on demand
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">This week</div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl border border-white/10 bg-white/5 relative overflow-hidden"
                  >
                    <div className="absolute bottom-2 left-2 h-1.5 w-6 rounded-full bg-white/25" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Strava sync</div>
              <div className="mt-2 text-white font-semibold">Planned vs Completed</div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Bike</span>
                  <span>✔ 2 / 3</span>
                </div>
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Run</span>
                  <span>✔ 2 / 2</span>
                </div>
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Swim</span>
                  <span>✔ 1 / 2</span>
                </div>
              </div>

              <div className="mt-4 h-24 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent" />
              <div className="mt-3 text-xs text-white/55">
                Activities flow in automatically when connected.
              </div>
            </div>
          </div>
        </div>

        {/* subtle “motion” feel via gradient */}
        <div className="mt-5 h-2 w-full rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10" />
      </div>
    </div>
  );
}

function LogoPills() {
  const items = ['Strava', 'Garmin', 'Wahoo', 'Apple Watch', 'COROS'];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
        >
          {x}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

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

  const handlePrimary = () => router.push((ctas.primary as any).href);
  const handleSecondary = () => {
    if ('href' in ctas.secondary) router.push((ctas.secondary as any).href);
    else scrollHowItWorks();
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingHeader
        authed={authed}
        onLogin={() => router.push('/login')}
        onSchedule={() => router.push('/schedule')}
      />

      {/* ---------------- HERO BAND (dark, premium, TP-esque) ---------------- */}
      <section className="relative overflow-hidden bg-[#070A12]">
        {/* Background: subtle “enterprise” glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full bg-white/10 blur-3xl opacity-60" />
          <div className="absolute top-24 right-[-180px] h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl opacity-60" />
          <div className="absolute top-64 left-[-200px] h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl opacity-50" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-14 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="flex flex-wrap gap-2">
                <Pill>Instant plan generation</Pill>
                <Pill>Strava-connected tracking</Pill>
                <Pill>Mobile-first calendar</Pill>
              </div>

              <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-white">
                Training plans that feel like a platform.
              </h1>

              <p className="mt-4 text-lg text-white/70 leading-relaxed">
                Generate a complete endurance plan in minutes, then use your calendar + Strava data
                to stay on track and learn what’s working.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePrimary}
                  className="bg-white text-gray-900 px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90"
                >
                  {ctas.primary.label}
                </button>

                <button
                  onClick={handleSecondary}
                  className="bg-transparent text-white px-6 py-3 rounded-full text-sm font-medium border border-white/20 hover:bg-white/5"
                >
                  {ctas.secondary.label}
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  Plan → calendar → completion
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  Strava sync for real training
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  Detailed workouts when you want them
                </span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <ProductPreviewPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- “PLAN BUILDER” BAND (white, with your generator card) ---------------- */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <BandTitle
                eyebrow="Start here"
                title="Instant plan generation—built around your race."
                desc="Pick a race, a date, and your available hours. Get a week-by-week plan you can actually execute."
              />
              <div className="mt-6">
                <LogoPills />
                <p className="mt-3 text-sm text-gray-500">
                  Strava integration helps you compare planned vs completed over time.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
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
        </div>
      </section>

      {/* ---------------- ECOSYSTEM BAND (dark, TP-esque “platform” feel) ---------------- */}
      <section className="bg-[#070A12]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <BandTitle
            dark
            eyebrow="The system"
            title="A complete training workflow—not just a plan file."
            desc="Plans are only useful if you can execute them. TrainGPT is built around calendar-first execution and real training data."
          />

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white">Plan</div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Generate a week-by-week structure aligned to your race date and time budget.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white">Calendar</div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                See sessions at a glance, stay oriented, and keep the next workout obvious.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white">Track</div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Sync Strava workouts and compare planned vs completed automatically.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white">Detail</div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Generate structured warmup/main/cooldown when you want more specificity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- STRAVA BAND (white, integration proof) ---------------- */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <BandTitle
                eyebrow="Strava sync"
                title="Your real training is the source of truth."
                desc="When connected, your completed workouts flow into TrainGPT so you can track consistency and compare planned vs completed."
              />
              <div className="mt-6">
                <button
                  onClick={handlePrimary}
                  className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                >
                  {ctas.primary.label}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10">
                <div className="text-sm font-semibold text-gray-900">How it flows</div>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Strava activities → matched to your calendar → marked complete → reflected in weekly totals.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs text-gray-500">1</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Connect Strava</div>
                    <div className="mt-1 text-sm text-gray-600">Import recent workouts automatically.</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs text-gray-500">2</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Match + track</div>
                    <div className="mt-1 text-sm text-gray-600">
                      Compare planned sessions vs completed training.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs text-gray-500">3</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Learn + adjust</div>
                    <div className="mt-1 text-sm text-gray-600">
                      Stay consistent and refine over time.
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
                    Planned vs Completed
                  </span>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
                    Weekly volume
                  </span>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
                    Consistency signals
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 border-t border-gray-200" />
        </div>
      </section>

      {/* ---------------- FEATURES GRID BAND (white, tightened) ---------------- */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <BandTitle
            eyebrow="Core features"
            title="Everything you need to execute."
            desc="A clean calendar, structured plans, and optional detail—without the noise."
          />

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              title="Week-by-week structure"
              desc="A realistic weekly plan built around your race date, experience, and available time."
            />
            <FeatureCard
              title="Instant plan generation"
              desc="Generate your full plan quickly—then re-generate whenever life changes or goals shift."
            />
            <FeatureCard
              title="Calendar-first UX"
              desc="See sessions at a glance, check them off, and keep the next workout obvious."
            />
            <FeatureCard
              title="Strava-powered tracking"
              desc="Sync completed workouts and compare planned vs completed over time."
            />
          </div>

          <div className="mt-14 rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Get structure instantly. Add detail only when you want it.
              </h3>
              <p className="mt-2 text-gray-600">
                Start with a clear weekly framework, then generate a detailed workout for any session.
              </p>
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
        </div>
      </section>

      {/* Blog + footer */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
