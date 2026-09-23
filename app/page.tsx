'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { track } from '@/lib/analytics/posthog-client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';
import Image from 'next/image';
import Link from 'next/link';
import workoutScreenshot from '@/public/landing/mobile-workout.png';
import dashboardScreenshot from '@/public/landing/dashboard.png';
import styles from './landing.module.css';

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
    router.push(authed ? '/plan' : `/login?next=${encodeURIComponent('/plan')}`);
  };
  const goLogin = () => router.push(`/login?next=${encodeURIComponent('/schedule')}`);
  const goSchedule = () => router.push('/schedule');

  return (
    <main className={`${styles.landing} min-h-screen bg-[#FBFBFA] text-[#101114]`}>
      <header className="border-b border-[#E3E0D8]">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" aria-label="Brick home" className="flex items-center gap-3"><Mark /><span className="text-lg font-black tracking-tight">Brick</span></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-semibold text-[#4B5563] md:flex">
            <a href="#distances">Your distance</a><a href="#how">How it works</a><a href="#product">Inside Brick</a>
          </nav>
          <button type="button" onClick={authed ? goSchedule : goLogin} className="rounded-full border border-[#E3E0D8] bg-white px-5 py-3 text-sm font-bold">{authed ? 'Open app' : 'Log in'}</button>
        </div>
      </header>

      <section className="px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-20">
            <div>
              <Label>Adaptive endurance training</Label>
              <h1 className="mt-6 max-w-3xl text-[3.7rem] font-black leading-[0.96] tracking-[-0.075em] sm:text-[5.5rem] lg:text-[6.4rem]">Train for<br />what’s next.</h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#4B5563] sm:text-xl">Personalized training for runners and triathletes. Build your plan, connect Strava, and let your training adapt as you go.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={goPrimary} className="rounded-full bg-[#101114] px-7 py-4 text-sm font-bold text-white hover:bg-[#25272D]">Build my plan <span aria-hidden="true">↗</span></button>
                <a href="#product" className="inline-flex items-center justify-center rounded-full border border-[#E3E0D8] bg-white px-7 py-4 text-sm font-bold">Explore Brick</a>
              </div>
              <p className="mt-4 text-sm text-[#6B7280]">Free today. No credit card required.</p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-[#E3E0D8] pt-6 text-sm font-semibold"><span>Running · 5K to marathon</span><span>Triathlon · Sprint to full distance</span></div>
            </div>
            <figure className="relative mx-auto w-full max-w-[360px] rounded-[2rem] border border-[#E3E0D8] bg-[#F1F3F5] p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between"><Label>A closer look</Label><span className="rounded-full bg-[#C6F33C] px-3 py-1 text-xs font-bold">Session detail</span></div>
              <Image src={workoutScreenshot} alt="Brick session detail showing a swim workout, warmup, main set, and completion button" priority sizes="(max-width: 640px) 280px, 304px" className="h-auto w-full rounded-2xl border border-[#E3E0D8]" />
              <figcaption className="mt-4 text-xs leading-5 text-[#6B7280]">From the plan to the session. Every workout in one place.</figcaption>
            </figure>
          </div>
          <div id="distances" className="mt-14 grid scroll-mt-8 gap-4 sm:mt-20 md:grid-cols-2">
            {[
              { name: 'Running', detail: 'Find your rhythm. Go the distance.', distances: ['5K', '10K', 'Half marathon', 'Marathon'] },
              { name: 'Triathlon', detail: 'Bring swim, bike, and run together.', distances: ['Sprint triathlon', 'Olympic triathlon', '70.3', 'Full-distance triathlon'] },
            ].map((sport) => (
              <article key={sport.name} className="rounded-[2rem] border border-[#E3E0D8] bg-white p-6 sm:p-8">
                <h2 className="text-3xl font-black tracking-[-0.05em]">{sport.name}</h2>
                <p className="mt-2 text-sm text-[#6B7280]">{sport.detail}</p>
                <ul className="mt-5 flex flex-wrap gap-2">{sport.distances.map((distance) => <li key={distance} className="rounded-full bg-[#F1F3F5] px-3 py-2 text-sm font-semibold">{distance}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-8 border-y border-[#E3E0D8] bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Label>Built around you</Label>
          <h2 className="mt-4 max-w-2xl text-4xl font-black leading-tight tracking-[-0.055em] sm:text-5xl">Your goal. Your starting point.<br />A plan that keeps up.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ProductCard eyebrow="01 / Plan" title="Start where you are." body="Your event, current fitness, and available training time shape your plan. Build toward your next start line with a week that fits your life." />
            <ProductCard eyebrow="02 / Connect" title="Let training count." body="Connect Strava to bring your activities into Brick automatically and match completed training to your planned sessions." />
            <ProductCard eyebrow="03 / Adapt" title="Keep moving forward." body="Brick uses completed training to adapt the week ahead, so your plan stays connected to the work you actually do." />
          </div>
          <Image src={compatibleStrava} alt="Compatible with Strava" width={220} height={48} className="mt-8 h-auto max-w-full" />
        </div>
      </section>

      <section id="product" className="scroll-mt-8 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><Label>Your training, together</Label><h2 className="mt-4 max-w-xl text-4xl font-black leading-tight tracking-[-0.055em] sm:text-5xl">The whole plan.<br />Not just today’s workout.</h2></div>
            <p className="max-w-sm text-base leading-7 text-[#6B7280]">Follow your sessions, track completed training, and see how your week is taking shape. One place to return to, all the way to race day.</p>
          </div>
          <figure className="mt-10 rounded-[2rem] border border-[#E3E0D8] bg-[#F1F3F5] p-3 sm:p-6">
            <Image src={dashboardScreenshot} alt="Brick coaching dashboard showing planned training, completed time, key sessions, and a weekly summary" sizes="(max-width: 1152px) 100vw, 1100px" className="h-auto w-full rounded-xl border border-[#E3E0D8]" />
            <figcaption className="px-2 pb-1 pt-4 text-xs leading-5 text-[#6B7280]">Inside Brick: a training overview. Example shown is a triathlon plan.</figcaption>
          </figure>
        </div>
      </section>

      <section className="bg-[#101114] px-5 py-16 text-white sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C6F33C]">One session at a time</p>
          <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-[-0.055em] sm:text-6xl">Your next start line<br />starts here.</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/70">From your first 5K to a full-distance triathlon. Build a plan around the athlete you are and the event ahead.</p>
          <button type="button" onClick={goPrimary} className="mt-8 rounded-full bg-[#C6F33C] px-7 py-4 text-sm font-bold text-[#101114]">Build my plan <span aria-hidden="true">↗</span></button>
          <p className="mt-4 text-sm text-white/70">Free today. No credit card required.</p>
        </div>
      </section>
      <section id="resources" className="bg-white"><BlogPreview /></section>
      <Footer />
    </main>
  );
}
