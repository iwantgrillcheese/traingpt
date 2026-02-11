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

  const stravaConnectHref = useMemo(() => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    if (!clientId) return '/settings';

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return '/settings';

    const callback = `${origin}/api/strava/callback`;
    const returnTo = '/plan?source=strava';

    return `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      callback
    )}&scope=activity:read_all,profile:read_all&approval_prompt=auto&state=${encodeURIComponent(returnTo)}`;
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
      if (!stravaConnected) {
        return {
          primary: { label: 'Generate my plan', href: '/plan' },
          secondary: { label: 'Connect Strava for smarter plan generation', href: stravaConnectHref },
        };
      }

      return {
        primary: { label: 'Generate my plan', href: '/plan' },
        secondary: { label: 'See how it works', kind: 'scroll' as const },
      };
    }

    return {
      primary: { label: 'Sign in to generate your plan', href: '/login' },
      secondary: { label: 'See how it works', kind: 'scroll' as const },
    };
  }, [session, hasPlan, stravaConnected, stravaConnectHref]);

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

  const handleCtaNavigation = (href: string) => {
    if (href.startsWith('http')) {
      window.location.href = href;
      return;
    }

    router.push(href);
  };

  const handlePrimary = () => handleCtaNavigation((ctas.primary as any).href);
  const handleSecondary = () => {
    if ('href' in ctas.secondary) handleCtaNavigation((ctas.secondary as any).href);
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
      <section id="home" className="relative overflow-hidden bg-[#070A12] pt-16 scroll-mt-24">
        {/* Background: subtle “enterprise” glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-44 left-1/2 -translate-x-1/2 h-[740px] w-[1180px] rounded-full bg-white/10 blur-3xl opacity-60 animate-pulse" />
          <div className="absolute top-28 right-[-200px] h-[460px] w-[460px] rounded-full bg-white/10 blur-3xl opacity-55" />
          <div className="absolute top-72 left-[-220px] h-[460px] w-[460px] rounded-full bg-white/10 blur-3xl opacity-45" />

          {/* subtle “shine” overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-70" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <Reveal>
                <div className="flex flex-wrap gap-2">
                  <Pill>Instant plan generation</Pill>
                  <Pill>Strava-connected tracking</Pill>
                  <Pill>Mobile-first calendar</Pill>
                </div>
              </Reveal>

              <Reveal delayMs={80}>
                <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-white">
                  Training plans that feel like a platform.
                </h1>
              </Reveal>

              <Reveal delayMs={140}>
                <p className="mt-4 text-lg text-white/70 leading-relaxed">
                  Generate a complete endurance plan in minutes, then use your calendar + Strava data
                  to stay on track and learn what’s working.
                </p>
              </Reveal>

              <Reveal delayMs={200}>
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
              </Reveal>

              <Reveal delayMs={260}>
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
              </Reveal>
            </div>

            <div className="lg:col-span-6">
              <Reveal delayMs={180}>
                <ProductPreviewPanel />
              </Reveal>
            </div>
          </div>

          <div className="mt-12">
            <ShineDivider dark />
          </div>
        </div>
      </section>

      {/* ---------------- PLAN BUILDER BAND (white) ---------------- */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <Reveal>
                <BandTitle
                  eyebrow="Start here"
                  title="Instant plan generation—built around your race."
                  desc="Pick a race, a date, and your available hours. Get a week-by-week plan you can actually execute."
                />
              </Reveal>

              <Reveal delayMs={120}>
                <div className="mt-6">
                  <LogoPills />
                  <p className="mt-3 text-sm text-gray-500">
                    Strava integration helps you compare planned vs completed over time.
                  </p>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delayMs={100}>
                <GeneratorCard
                  onPrimary={handlePrimary}
                  primaryLabel={ctas.primary.label}
                  onSecondary={handleSecondary}
                  secondaryLabel={ctas.secondary.label}
                  onTertiary={ctas.tertiary?.kind === 'scroll' ? scrollHowItWorks : undefined}
                  tertiaryLabel={ctas.tertiary?.label}
                />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ECOSYSTEM BAND (dark) ---------------- */}
      <section id="features" className="bg-[#070A12] scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <BandTitle
              dark
              eyebrow="The system"
              title="A complete training workflow—not just a plan file."
              desc="Plans are only useful if you can execute them. TrainGPT is built around calendar-first execution and real training data."
            />
          </Reveal>

          <Reveal delayMs={120}>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DarkCard
                title="Plan"
                desc="Generate a week-by-week structure aligned to your race date and time budget."
              />
              <DarkCard
                title="Calendar"
                desc="See sessions at a glance, stay oriented, and keep the next workout obvious."
              />
              <DarkCard
                title="Track"
                desc="Sync Strava workouts and compare planned vs completed automatically."
              />
              <DarkCard
                title="Detail"
                desc="Generate structured warmup/main/cooldown when you want more specificity."
              />
            </div>
          </Reveal>

          <div className="mt-14">
            <ShineDivider dark />
          </div>
        </div>
      </section>

      {/* ---------------- STRAVA BAND (white) ---------------- */}
      <section id="strava" className="bg-white scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <Reveal>
                <BandTitle
                  eyebrow="Strava sync"
                  title="Your real training is the source of truth."
                  desc="When connected, completed workouts flow into TrainGPT so you can track consistency and compare planned vs completed."
                />
              </Reveal>

              <Reveal delayMs={140}>
                <div className="mt-6">
                  <button
                    onClick={handlePrimary}
                    className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                  >
                    {ctas.primary.label}
                  </button>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delayMs={120}>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 transition-transform duration-200 hover:-translate-y-0.5">
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
              </Reveal>
            </div>
          </div>

          <div className="mt-16">
            <ShineDivider />
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS (white, tightened) ---------------- */}
      <section id="how-it-works" className="bg-white scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <BandTitle
              eyebrow="How it works"
              title="A plan you can follow—and adapt."
              desc="Start with clear weekly structure. Generate detailed workouts only when you want more precision."
            />
          </Reveal>

          <Reveal delayMs={120}>
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
                title="Detailed workouts on demand"
                desc="Tap any session to generate warmup, main set, and cooldown—short, structured, and specific."
              />
            </div>
          </Reveal>

          <Reveal delayMs={180}>
            <div className="mt-14 rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-transform duration-200 hover:-translate-y-0.5">
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
          </Reveal>
        </div>
      </section>

      {/* Blog + footer */}
      <div id="blog" className="max-w-6xl mx-auto px-6 pb-10 scroll-mt-24">
        <Reveal>
          <BlogPreview />
        </Reveal>
      </div>

      <Footer />
    </div>
  );
}
