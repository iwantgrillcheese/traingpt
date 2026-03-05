'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

/* ------------------------------ tiny animation helpers (no deps) ------------------------------ */

function useRevealOnScroll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]')) as HTMLElement[];
    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = 'true';
            obs.unobserve(e.target);
          }
        }
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ------------------------------ reveal (no tailwind data-variants) ------------------------------ */

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
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
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
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}


function ShineDivider({ dark }: { dark?: boolean }) {
  return (
    <div
      className={
        dark
          ? 'h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-70'
          : 'h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-90'
      }
    />
  );
}

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
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
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
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="text-base font-semibold text-gray-900">{title}</div>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function DarkCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-white/70 leading-relaxed">{desc}</p>
    </div>
  );
}

/* ------------------------------ Marketing Header (TP-style) ------------------------------ */

function MarketingHeader({
  authed,
  onLogin,
  onSchedule,
}: {
  authed: boolean;
  onLogin: () => void;
  onSchedule: () => void;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string>('home');

  const NAV = [
    { id: 'features', label: 'Features' },
    { id: 'strava', label: 'Strava' },
    { id: 'how-it-works', label: 'How it works' },
    { id: 'blog', label: 'Resources' },
  ];

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    const ids = ['home', ...NAV.map((n) => n.id)];
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { root: null, rootMargin: '-20% 0px -70% 0px', threshold: [0.05, 0.1, 0.2, 0.3] }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const headerClass = scrolled
    ? 'bg-white/80 backdrop-blur border-b border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]'
    : 'bg-transparent border-b border-transparent';

  const brandText = scrolled ? 'text-gray-900' : 'text-white';
  const navText = scrolled ? 'text-gray-700' : 'text-white/75';
  const navHover = scrolled ? 'hover:text-gray-900' : 'hover:text-white';
  const navActive = scrolled ? 'text-gray-900' : 'text-white';

  const outlineBtn = scrolled
    ? 'border-gray-200 bg-white hover:bg-gray-50 text-gray-900'
    : 'border-white/20 bg-white/5 hover:bg-white/10 text-white';

  const primaryBtn = scrolled
    ? 'bg-gray-900 text-white hover:bg-gray-800'
    : 'bg-white text-gray-900 hover:bg-white/90';

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-200 ${headerClass}`}>
     <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Brand */}
        <button
          onClick={() => scrollTo('home')}
          className="flex items-center gap-3 select-none shrink-0"
          aria-label="Go to top"
        >
          <div
            className={`h-8 w-8 rounded-xl flex items-center justify-center text-[12px] font-semibold transition-colors ${
              scrolled ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}
          >
            T
          </div>

          <div className="flex flex-col leading-none">
            <span className={`text-[15px] font-semibold tracking-tight ${brandText}`}>
              TrainGPT
            </span>
            <span
              className={`mt-1 hidden sm:block text-[11px] ${
                scrolled ? 'text-gray-500' : 'text-white/55'
              }`}
            >
              Plans • Calendar • Strava
            </span>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`px-3 py-2 rounded-full text-sm transition-colors ${
                  isActive ? `${navActive} bg-black/5 ${!scrolled ? 'bg-white/10' : ''}` : navText
                } ${navHover}`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className={`md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full border transition-colors ${outlineBtn}`}
            aria-label="Open menu"
          >
            <span className="text-lg leading-none">{open ? '×' : '≡'}</span>
          </button>

          {authed ? (
            <>
              <button
                onClick={onSchedule}
                className={`hidden sm:inline-flex text-sm px-4 py-2 rounded-full border transition-colors ${outlineBtn}`}
              >
                Open schedule
              </button>
              <button
                onClick={onSchedule}
                className={`hidden md:inline-flex text-sm px-4 py-2 rounded-full transition-colors ${primaryBtn}`}
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onLogin}
                className={`hidden sm:inline-flex text-sm px-4 py-2 rounded-full border transition-colors ${outlineBtn}`}
              >
                Log in
              </button>
              <button
                onClick={onLogin}
                className={`hidden md:inline-flex text-sm px-4 py-2 rounded-full transition-colors ${primaryBtn}`}
              >
                Get started
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div
          className={`md:hidden border-t ${
            scrolled
              ? 'border-gray-100 bg-white/90 backdrop-blur'
              : 'border-white/10 bg-[#070A12]/95 backdrop-blur'
          }`}
        >
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-2">
            {NAV.map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-sm border transition-colors ${
                    scrolled
                      ? isActive
                        ? 'border-gray-200 bg-gray-50 text-gray-900'
                        : 'border-gray-100 bg-white text-gray-700 hover:bg-gray-50'
                      : isActive
                      ? 'border-white/15 bg-white/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <div className="pt-2 flex gap-2">
              {authed ? (
                <button
                  onClick={onSchedule}
                  className={`w-full text-sm px-4 py-3 rounded-2xl transition-colors ${
                    scrolled ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
                  }`}
                >
                  Open schedule
                </button>
              ) : (
                <button
                  onClick={onLogin}
                  className={`w-full text-sm px-4 py-3 rounded-2xl transition-colors ${
                    scrolled ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
                  }`}
                >
                  Log in
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
    <div className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/30" />
          <span className="h-2 w-2 rounded-full bg-white/30" />
          <span className="h-2 w-2 rounded-full bg-white/30" />
        </div>
        <div className="text-xs text-white/60">Calendar • Plan • Strava</div>
      </div>

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

        <div className="mt-5 h-2 w-full rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10 opacity-80" />
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
  const [stravaConnected, setStravaConnected] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadUserState = async (userId: string) => {
      const [planRes, profileRes] = await Promise.all([
        supabase
          .from('plans')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('profiles').select('strava_access_token').eq('id', userId).maybeSingle(),
      ]);

      if (!alive) return;

      if (planRes.error) {
        console.warn('[home] plan lookup error', planRes.error);
        setHasPlan(false);
      } else {
        setHasPlan(!!planRes.data?.id);
      }

      if (profileRes.error) {
        console.warn('[home] profile lookup error', profileRes.error);
        setStravaConnected(false);
      } else {
        setStravaConnected(!!profileRes.data?.strava_access_token);
      }
    };

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) console.warn('[home] getSession error', error);

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setAuthReady(true);

        if (nextSession?.user?.id) await loadUserState(nextSession.user.id);
        else {
          setHasPlan(false);
          setStravaConnected(false);
        }
      } catch (e) {
        if (!alive) return;
        console.warn('[home] getSession threw', e);
        setSession(null);
        setHasPlan(false);
        setStravaConnected(false);
        setAuthReady(true);
      }
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;

      setSession(s ?? null);
      setAuthReady(true);

      if (s?.user?.id) loadUserState(s.user.id);
      else {
        setHasPlan(false);
        setStravaConnected(false);
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

  const [generatorInputs, setGeneratorInputs] = useState({
    raceType: '70.3',
    raceDate: '',
    experience: 'Intermediate',
    maxHours: '8',
    restDay: '',
    userNote: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
    advancedRestDay: '',
  });
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const authed = !!session;

  const scrollHowItWorks = () => {
    const el = document.querySelector('#how-it-works');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const buildPlanPath = () => {
    const params = new URLSearchParams();
    if (generatorInputs.raceType) params.set('raceType', generatorInputs.raceType);
    if (generatorInputs.raceDate) params.set('raceDate', generatorInputs.raceDate);
    if (generatorInputs.experience) params.set('experience', generatorInputs.experience);
    if (generatorInputs.maxHours) params.set('maxHours', generatorInputs.maxHours);
    if (generatorInputs.restDay) params.set('restDay', generatorInputs.restDay);
    if (generatorInputs.userNote) params.set('userNote', generatorInputs.userNote);
    if (generatorInputs.bikeFTP) params.set('bikeFTP', generatorInputs.bikeFTP);
    if (generatorInputs.runPace) params.set('runPace', generatorInputs.runPace);
    if (generatorInputs.swimPace) params.set('swimPace', generatorInputs.swimPace);
    if (generatorInputs.advancedRestDay) params.set('advancedRestDay', generatorInputs.advancedRestDay);
    return `/plan?${params.toString()}`;
  };

  const handlePrimary = () => {
    const planPath = buildPlanPath();
    if (authed) {
      router.push(planPath);
      return;
    }

    router.push(`/login?next=${encodeURIComponent(planPath)}`);
  };

  const handleSecondary = () => scrollHowItWorks();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingHeader
        authed={authed}
        onLogin={() => router.push('/login')}
        onSchedule={() => router.push('/schedule')}
      />

      {/* 1) HERO */}
      <section id="home" className="bg-white pt-16 md:pt-20 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <Reveal>
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
                  A smarter training plan for your next triathlon
                </h1>
                <p className="mt-4 text-lg text-gray-600 leading-relaxed max-w-2xl">
                  Built around your race date, experience, and weekly availability. TrainGPT creates a structured plan and syncs your completed workouts automatically with Strava.
                </p>
              </Reveal>

              <Reveal delayMs={100}>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handlePrimary}
                    className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                  >
                    Create Your Training Plan
                  </button>
                  <button
                    onClick={scrollHowItWorks}
                    className="bg-white text-gray-900 px-6 py-3 rounded-full text-sm font-medium border border-gray-200 hover:bg-gray-50"
                  >
                    See How It Works
                  </button>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-6">
              <Reveal delayMs={120}>
                <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
                  <div className="text-base font-semibold text-gray-900">Build your training plan</div>

                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Race</span>
                        <select
                          value={generatorInputs.raceType}
                          onChange={(e) => setGeneratorInputs((p) => ({ ...p, raceType: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                        >
                          <option>Sprint</option>
                          <option>Olympic</option>
                          <option>70.3</option>
                          <option>Ironman</option>
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Race date</span>
                        <input
                          type="date"
                          value={generatorInputs.raceDate}
                          onChange={(e) => setGeneratorInputs((p) => ({ ...p, raceDate: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Experience level</span>
                        <select
                          value={generatorInputs.experience}
                          onChange={(e) => setGeneratorInputs((p) => ({ ...p, experience: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                        >
                          <option>Beginner</option>
                          <option>Intermediate</option>
                          <option>Advanced</option>
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Weekly training hours</span>
                        <input
                          type="number"
                          min={1}
                          max={25}
                          placeholder="8"
                          value={generatorInputs.maxHours}
                          onChange={(e) => setGeneratorInputs((p) => ({ ...p, maxHours: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                        />
                      </label>

                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Rest day</span>
                        <select
                          value={generatorInputs.restDay}
                          onChange={(e) => setGeneratorInputs((p) => ({ ...p, restDay: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                        >
                          <option value="">Rest day (optional)</option>
                          <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option>
                        </select>
                      </label>
                    </div>

                    <label className="space-y-1 block">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Optional coaching notes</span>
                      <textarea
                        rows={3}
                        value={generatorInputs.userNote}
                        onChange={(e) => setGeneratorInputs((p) => ({ ...p, userNote: e.target.value }))}
                        placeholder="I prefer long rides on Saturdays and long runs on Sundays. I’m targeting sub-5 at Santa Cruz."
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                      />
                    </label>

                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings((v) => !v)}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-800"
                      >
                        <span>Advanced training settings</span>
                        <span className="text-gray-500">{showAdvancedSettings ? 'Hide' : 'Show'}</span>
                      </button>

                      {showAdvancedSettings ? (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Bike FTP</span>
                            <input
                              type="number"
                              value={generatorInputs.bikeFTP}
                              onChange={(e) => setGeneratorInputs((p) => ({ ...p, bikeFTP: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Run threshold pace</span>
                            <input
                              type="text"
                              value={generatorInputs.runPace}
                              onChange={(e) => setGeneratorInputs((p) => ({ ...p, runPace: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Swim threshold pace</span>
                            <input
                              type="text"
                              value={generatorInputs.swimPace}
                              onChange={(e) => setGeneratorInputs((p) => ({ ...p, swimPace: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Preferred rest day</span>
                            <select
                              value={generatorInputs.advancedRestDay}
                              onChange={(e) => setGeneratorInputs((p) => ({ ...p, advancedRestDay: e.target.value, restDay: e.target.value || p.restDay }))}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                            >
                              <option value="">None</option>
                              <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option>
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    onClick={handlePrimary}
                    className="mt-4 w-full bg-black text-white px-5 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                  >
                    Generate my plan
                  </button>
                  <p className="mt-2 text-xs text-gray-500">You’ll log in before we generate your plan.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 h-px" />

      {/* 2) INSTANT PLAN GENERATION */}
      <section id="how-it-works" className="bg-white scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <Reveal>
            <BandTitle
              eyebrow="Instant plan generation"
              title="Build a full training plan in seconds"
              desc="Tell TrainGPT your race date, experience level, and weekly training time. The system generates a structured swim, bike, and run plan designed around your goal race. Each week includes balanced training volume, long sessions, recovery weeks, and brick workouts. This gives athletes a clear structure to follow without needing to piece together training plans manually."
            />
          </Reveal>

          <Reveal delayMs={120}>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
              {['Race', 'Plan', 'Calendar'].map((step, idx) => (
                <div key={step} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-xs text-gray-500">{idx + 1}</div>
                  <div className="mt-1 text-base font-semibold text-gray-900">{step}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-gray-50 h-px" />

      {/* 3) TRAINING CALENDAR */}
      <section id="features" className="bg-white scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-6">
              <Reveal>
                <BandTitle
                  eyebrow="Training calendar"
                  title="Know exactly what to train each day"
                  desc="Your entire training block lives in a clean, simple calendar. Each day shows the session for that workout, including duration and intensity. This removes the guesswork and makes it easier to stay consistent throughout the season."
                />
              </Reveal>
            </div>
            <div className="lg:col-span-6">
              <Reveal delayMs={120}>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
                  <div className="grid grid-cols-2 gap-3">
                    {['Swim · 45 min', 'Bike · 75 min', 'Run · 50 min', 'Brick · 60 min'].map((x, i) => (
                      <div key={x} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${i % 3 === 0 ? 'bg-blue-300' : i % 3 === 1 ? 'bg-emerald-300' : 'bg-orange-300'}`} />
                        {x}
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 h-px" />

      {/* 4) STRAVA */}
      <section id="strava" className="bg-white scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <Reveal>
            <BandTitle
              eyebrow="Strava integration"
              title="Your real workouts sync automatically"
              desc="TrainGPT connects with Strava so completed workouts appear alongside your planned sessions. You can see how your training compares to the plan and track weekly volume across swim, bike, and run. This keeps your training organized without requiring manual logging."
            />
          </Reveal>

          <Reveal delayMs={120}>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">Planned</div>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <div>Swim · 2 sessions</div>
                  <div>Bike · 3 sessions</div>
                  <div>Run · 3 sessions</div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">Completed</div>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <div>Swim · 2 sessions</div>
                  <div>Bike · 2 sessions</div>
                  <div>Run · 3 sessions</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-gray-50 h-px" />

      {/* 5) FUELING + TRAINING TOOLS */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <Reveal>
            <BandTitle
              eyebrow="Fueling + training tools"
              title="Training support beyond the plan"
              desc="TrainGPT also includes tools designed to support the rest of your training process. Athletes can explore fueling guidance, review training patterns, and adjust workouts when schedules change. The goal is to make the entire training process easier to manage from one place."
            />
          </Reveal>
        </div>
      </section>

      <section className="bg-gray-50 h-px" />

      {/* 6) AI COACH */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <Reveal>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10">
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-900">
                Ask questions about your training
              </h3>
              <p className="mt-3 text-gray-600 leading-relaxed max-w-3xl">
                If questions come up during your training block, the built-in coach can help explain workouts or provide guidance. Because it understands your plan, the responses stay relevant to your training.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-gray-50 h-px" />

      {/* 7) BLOG PREVIEW */}
      <div id="blog" className="max-w-6xl mx-auto px-6 py-10 scroll-mt-24">
        <Reveal>
          <BlogPreview />
        </Reveal>
      </div>

      <section className="bg-gray-50 h-px" />

      {/* 8) FINAL CTA */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <Reveal>
            <div className="rounded-3xl border border-gray-200 bg-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Start your next training block with a plan built for you.
              </h3>
              <button
                onClick={handlePrimary}
                className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800 w-full md:w-auto"
              >
                Create your training plan
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
