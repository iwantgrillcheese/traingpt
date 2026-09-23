'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { track } from '@/lib/analytics/posthog-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';
import PublicPlanPreview from './components/PublicPlanPreview';

const compatibleStrava = '/strava/api_logo_cptblWith_strava_horiz_orange.svg';

function Mark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#101114] text-[12px] font-black tracking-[-0.08em] text-white">
      B
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6B7280]">{children}</p>;
}

function ProductCard({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children?: ReactNode }) {
  return (
    <article className="rounded-[2rem] border border-[#E3E0D8] bg-white p-6 shadow-[0_18px_60px_rgba(16,17,20,0.05)] sm:p-8">
      <Label>{eyebrow}</Label>
      <h3 className="mt-4 text-3xl font-black tracking-[-0.055em] text-[#101114]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#6B7280]">{body}</p>
      {children}
    </article>
  );
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null>(null);

  useEffect(() => {
    let alive = true;
    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;
      if (error) console.warn('[home] getSession error', error);
      setSession(data.session ?? null);
    };
    void syncSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: SupabaseSession | null) => {
      if (!alive) return;
      setSession(nextSession ?? null);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const authed = Boolean(session?.user);
  const goPrimary = () => {
    track('homepage_primary_cta_clicked', { authenticated: authed });
    router.push(authed ? '/plan' : '/preview');
  };
  const goLogin = () => router.push(`/login?next=${encodeURIComponent('/schedule')}`);
  const goSchedule = () => router.push('/schedule');

  return (
    <main className="min-h-screen overflow-hidden bg-[#FBFBFA] text-[#101114]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E3E0D8]/70 bg-[#FBFBFA]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3" aria-label="Go to top">
            <Mark />
            <span className="text-sm font-black tracking-[-0.03em]">Brick</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#how" className="rounded-full px-3 py-2 text-sm font-semibold text-[#6B7280] hover:bg-white hover:text-[#101114]">How it works</a>
            <a href="#preview" className="rounded-full px-3 py-2 text-sm font-semibold text-[#6B7280] hover:bg-white hover:text-[#101114]">Plan preview</a>
            <a href="#resources" className="rounded-full px-3 py-2 text-sm font-semibold text-[#6B7280] hover:bg-white hover:text-[#101114]">Resources</a>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={authed ? goSchedule : goLogin} className="rounded-full border border-[#E2E0D8] bg-white px-4 py-2 text-sm font-bold text-[#101114] hover:bg-[#F7F6F2]">
              {authed ? 'Open app' : 'Log in'}
            </button>
            <button type="button" onClick={goPrimary} className="rounded-full bg-[#101114] px-4 py-2 text-sm font-bold text-white hover:bg-[#25272D]">
              {authed ? 'Build plan' : 'Preview my plan'}
            </button>
          </div>
        </div>
      </header>

      <section className="relative isolate px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-16 -z-10 h-[620px] w-[920px] -translate-x-1/2 rounded-full bg-[#ECEAE5] opacity-80 blur-3xl" />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <Label>Adaptive triathlon training</Label>
            <h1 className="mx-auto mt-7 text-[4rem] font-black leading-[0.92] tracking-[-0.085em] sm:text-[6rem] lg:text-[7.2rem]">
              Triathlon training that adapts to your life.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#4B5563] sm:text-xl">
              Build a custom race plan, connect Strava, and let Brick keep the week aligned with the training you actually do.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={goPrimary} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#101114] px-6 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,17,20,0.16)]">
                {authed ? 'Open plan builder' : 'Preview my plan'}
              </button>
              <a href="#how" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-black text-[#101114]">
                See how it works
              </a>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#6B7280]">Sprint, Olympic, 70.3, and Ironman. Free today. No credit card.</p>
            <div className="mt-7 flex justify-center"><img src={compatibleStrava} alt="Compatible with Strava" className="h-auto w-[220px] max-w-full" /></div>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#E3E0D8] bg-white p-6"><p className="text-4xl font-black tracking-[-0.07em]">01</p><p className="mt-2 text-sm font-black">Build around your race and real availability.</p></div>
            <div className="rounded-3xl border border-[#E3E0D8] bg-white p-6"><p className="text-4xl font-black tracking-[-0.07em]">02</p><p className="mt-2 text-sm font-black">Strava matches what actually happened.</p></div>
            <div className="rounded-3xl border border-[#E3E0D8] bg-white p-6"><p className="text-4xl font-black tracking-[-0.07em]">03</p><p className="mt-2 text-sm font-black">The next week adapts instead of pretending life went perfectly.</p></div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-[#E3E0D8] bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl"><Label>How it works</Label><h2 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-6xl">The plan is only useful if it knows what you did.</h2></div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <ProductCard eyebrow="Plan" title="A real race build" body="Your race date, current fitness, available hours, rest day, long-session preferences, and training constraints shape the plan." />
            <ProductCard eyebrow="Track" title="Strava closes the loop" body="Rides, runs, and swims match back to planned sessions. Planned time stays planned; actual time stays actual." />
            <ProductCard eyebrow="Adapt" title="Missed work is not debt" body="Brick uses completed training to adjust the week ahead. Important sessions stay protected, but missed volume is not blindly stacked." />
          </div>
        </div>
      </section>

      <section id="preview" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl"><Label>Try it before login</Label><h2 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-6xl">Preview a week with four inputs.</h2><p className="mt-4 text-base leading-7 text-[#6B7280]">High-intent athletes should not have to create an account just to discover whether the product is useful.</p></div>
          <PublicPlanPreview />
        </div>
      </section>

      <section className="border-y border-[#E3E0D8] bg-[#101114] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Why Brick exists</p><h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.07em] sm:text-6xl">More useful than copy-pasting a plan into ChatGPT.</h2><p className="mt-5 max-w-2xl text-base leading-8 text-white/65">The intelligence can sit in the engine room. What matters to the athlete is that the plan remembers the race, sees completed training, keeps the schedule in one place, and explains what changed.</p></div>
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6"><p className="text-sm font-black">Built by a triathlete who got tired of rebuilding context every time.</p><p className="mt-3 text-sm leading-6 text-white/60">Brick does not pretend to replace a great human coach. It is meant to make structured, adaptive training accessible when a coach is not the right option.</p><a href="/about" className="mt-5 inline-flex text-sm font-black underline underline-offset-4">Read the story</a></div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <ProductCard eyebrow="Useful entry point" title="Free 70.3 plan" body="Preview a 70.3 week, then build the full race plan when it looks right."><a href="/free-70-3-training-plan" className="mt-5 inline-flex text-sm font-black underline underline-offset-4">Open 70.3 planner</a></ProductCard>
          <ProductCard eyebrow="Useful entry point" title="Free Ironman plan" body="See how long-course work fits your weekly hours before committing to the full build."><a href="/free-ironman-training-plan" className="mt-5 inline-flex text-sm font-black underline underline-offset-4">Open Ironman planner</a></ProductCard>
          <ProductCard eyebrow="Useful entry point" title="Any triathlon" body="Start with distance, date, available hours, and long-session day. No account required."><a href="/free-triathlon-training-plan" className="mt-5 inline-flex text-sm font-black underline underline-offset-4">Open triathlon planner</a></ProductCard>
        </div>
      </section>

      <section className="border-y border-[#E3E0D8] bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center"><Label>Free today</Label><h2 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-5xl">No credit card. No hidden activation wall.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#6B7280]">Brick is free while we build it with athletes. You can preview the product before signing up, and the saved product is designed for the full race build rather than a disposable PDF.</p><button type="button" onClick={goPrimary} className="mt-7 rounded-full bg-[#101114] px-6 py-3 text-sm font-black text-white">{authed ? 'Open Brick' : 'Preview my plan'}</button></div>
      </section>

      <section id="resources" className="bg-white"><BlogPreview /></section>
      <Footer />
    </main>
  );
}
