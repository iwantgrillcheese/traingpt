'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

const compatibleStrava = '/strava/api_logo_cptblWith_strava_horiz_orange.svg';
const connectStrava = '/strava/btn_strava_connect_with_orange.svg';
const races = ['Sprint', 'Olympic', '70.3', 'Ironman'];
const nav = [
  ['#calendar', 'Calendar'],
  ['#strava', 'Strava'],
  ['#adjustments', 'Adjustments'],
  ['#resources', 'Resources'],
];

function Mark() {
  return <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#101114] text-[15px] font-black tracking-[-0.08em] text-white">TG</span>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#635BFF]">{children}</p>;
}

function HeroPreview() {
  const sessions = [
    ['Mon', 'Recovery swim', '1,500 yd', 'Easy'],
    ['Tue', 'Tempo bike', '70 min', 'Key'],
    ['Wed', 'Aerobic run', '45 min', 'Z2'],
    ['Fri', 'Brick session', 'Bike + short run', 'Race prep'],
  ];
  return (
    <div className="relative">
      <div className="absolute -left-12 top-10 h-56 w-56 rounded-full bg-[#E6E1FF] blur-3xl" />
      <div className="absolute -right-12 bottom-6 h-56 w-56 rounded-full bg-[#FFE6DB] blur-3xl" />
      <div className="relative rounded-[2.25rem] border border-[#E7E5DE] bg-white p-5 shadow-[0_36px_90px_rgba(16,17,20,0.13)]">
        <div className="rounded-[1.75rem] bg-[#101114] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Generated plan</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h3 className="text-2xl font-black tracking-[-0.05em]">Santa Cruz 70.3 build</h3>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">Week 3</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">Custom sessions, matched activities, and weekly updates in one place.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['7h 20m', 'planned'],
              ['4 / 7', 'complete'],
              ['3', 'synced'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-3xl bg-white/10 p-4">
                <div className="text-2xl font-black tracking-[-0.06em]">{value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.map(([day, title, meta, tag]) => (
            <div key={title} className="flex items-center gap-3 rounded-3xl border border-[#E3E0D8] bg-white px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F5F4F0] text-xs font-black uppercase tracking-[0.12em] text-[#8A8F98]">{day}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">{title}</div>
                <div className="mt-0.5 text-xs font-medium text-[#6B7280]">{meta}</div>
              </div>
              <span className="rounded-full bg-[#F1EFFF] px-2.5 py-1 text-[10px] font-black text-[#635BFF]">{tag}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[1.5rem] border border-[#DAD4FF] bg-[#F1EFFF] p-4">
          <p className="text-sm font-black text-[#101114]">Weekly adjustment ready</p>
          <p className="mt-1 text-sm leading-6 text-[#4F4A70]">Three Strava activities matched this week. The next week updates around what actually happened.</p>
        </div>
      </div>
    </div>
  );
}

function CalendarCard() {
  const rows = [
    ['Swim', 'Monday', 'Recovery swim', '1,500 yd · smooth technique', 'Easy'],
    ['Bike', 'Tuesday', 'Tempo bike', '70 min · 3 x 12 min sweet spot', 'Key'],
    ['Run', 'Wednesday', 'Aerobic run', '45 min · conversational pace', 'Z2'],
    ['Brick', 'Friday', 'Brick session', 'Bike + short run · race rhythm', 'Race prep'],
  ];
  return (
    <div className="rounded-[2rem] border border-[#E3E0D8] bg-white p-5 shadow-[0_28px_90px_rgba(16,17,20,0.10)]">
      <div className="space-y-3">
        {rows.map(([sport, day, title, meta, tag]) => (
          <div key={`${day}-${title}`} className="flex items-center gap-4 rounded-3xl border border-[#E3E0D8] bg-white px-4 py-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F4F0] text-[10px] font-black uppercase tracking-[0.12em] text-[#8A8F98]">{sport}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">{day} · {title}</p>
              <p className="mt-1 text-sm text-[#6B7280]">{meta}</p>
            </div>
            <span className="rounded-full bg-[#F1EFFF] px-3 py-1 text-[11px] font-black text-[#635BFF]">{tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StravaCard() {
  const rows = [
    ['Ride', 'Morning Ride', '1:12:44 · 20.8 mi · 147w avg'],
    ['Run', 'Lunch Run', '39:18 · 4.7 mi · 8:21/mi'],
    ['Swim', 'Pool Swim', '34:10 · 1,900 yd · drills'],
  ];
  return (
    <div className="rounded-[2rem] border border-[#E3E0D8] bg-white p-5 shadow-[0_28px_90px_rgba(16,17,20,0.10)]">
      <div className="space-y-3">
        {rows.map(([sport, title, meta]) => (
          <div key={title} className="flex items-center gap-4 rounded-3xl border border-[#E3E0D8] bg-white px-4 py-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FC5200] text-[10px] font-black uppercase tracking-[0.12em] text-white">{sport}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">{title}</p>
              <p className="mt-1 text-sm text-[#6B7280]">{meta}</p>
            </div>
            <span className="text-sm font-black text-[#0A7A3D]">Matched</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[1.5rem] border border-[#DAD4FF] bg-[#F1EFFF] p-4">
        <p className="text-sm font-black text-[#101114]">3 activities matched this week</p>
        <p className="mt-1 text-sm leading-6 text-[#4F4A70]">Completed sessions update your plan and weekly volume automatically.</p>
      </div>
    </div>
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
    syncSession();
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
  const goPlan = () => router.push(authed ? '/plan' : `/login?next=${encodeURIComponent('/plan')}`);
  const goLogin = () => router.push(`/login?next=${encodeURIComponent('/schedule')}`);
  const goSchedule = () => router.push('/schedule');
  const goStrava = () => router.push(authed ? '/settings' : `/login?next=${encodeURIComponent('/settings')}`);

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#101114]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E3E0D8]/70 bg-[#FAFAFA]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3" aria-label="Go to top">
            <Mark />
            <span className="text-sm font-black tracking-[-0.03em]">TrainGPT</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(([href, label]) => <a key={href} href={href} className="rounded-full px-3 py-2 text-sm font-semibold text-[#6B7280] transition hover:bg-white hover:text-[#101114]">{label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={authed ? goSchedule : goLogin} className="rounded-full border border-[#E2E0D8] bg-white px-4 py-2 text-sm font-bold text-[#101114] transition hover:bg-[#F7F6F2]">{authed ? 'Open app' : 'Log in'}</button>
            <button type="button" onClick={authed ? goSchedule : goPlan} className="rounded-full bg-[#101114] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#25272D]">{authed ? 'Open schedule' : 'Build my plan'}</button>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden px-4 pt-28 sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-16 -z-10 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-[#E8E3FF] blur-3xl" />
        <div className="absolute right-0 top-40 -z-10 h-[320px] w-[320px] rounded-full bg-[#FFE7DD] blur-3xl" />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 pb-16 lg:grid-cols-12 lg:pb-20">
          <div className="lg:col-span-6">
            <Label>Free AI triathlon coaching</Label>
            <h1 className="mt-6 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.08em] sm:text-7xl lg:text-[5.7rem]">Triathlon training, on autopilot.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4B5563]">TrainGPT builds your race plan, reads your Strava training, and adjusts the week ahead when life gets in the way.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={goPlan} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#101114] px-6 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,17,20,0.20)] transition hover:-translate-y-0.5 hover:bg-[#25272D]">{authed ? 'Open plan builder' : 'Build my free plan'}</button>
              <a href="#calendar" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-black text-[#101114] transition hover:bg-[#F7F6F2]">See how it works</a>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#6B7280]">Sprint, Olympic, 70.3, and Ironman plans. Built in about 60 seconds.</p>
            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">Works with your training data</span>
              <img src={compatibleStrava} alt="Compatible with Strava" className="h-auto w-[210px] max-w-full" />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
              <span className="mr-1 font-bold text-[#8A8F98]">Built for</span>
              {races.map((race) => <span key={race} className="rounded-full border border-[#E3E0D8] bg-white px-4 py-2 font-black text-[#8A8F98] shadow-[0_8px_30px_rgba(16,17,20,0.03)]">{race}</span>)}
            </div>
          </div>
          <div className="lg:col-span-6"><HeroPreview /></div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3">
          {[
            ['Free', 'To generate'],
            ['60s', 'To a custom plan'],
            ['Weekly', 'Adjusted with Strava'],
          ].map(([value, label]) => <div key={value} className="rounded-[1.75rem] border border-[#E3E0D8] bg-white p-8 text-center shadow-[0_18px_60px_rgba(16,17,20,0.05)]"><p className="text-5xl font-black tracking-[-0.08em] text-[#635BFF]">{value}</p><p className="mt-3 text-sm font-black text-[#6B7280]">{label}</p></div>)}
        </div>
      </section>

      <section id="calendar" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Label>Calendar-first coaching</Label>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] md:text-6xl">Your plan, laid out like real life.</h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">Open TrainGPT and today&apos;s session is right there. Distance, zones, and intent. No spreadsheet, no second-guessing, just the work in front of you.</p>
          </div>
          <div className="lg:col-span-7"><CalendarCard /></div>
        </div>
      </section>

      <section id="strava" className="border-y border-[#E3E0D8] bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6 lg:order-2">
            <Label>Strava sync</Label>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] md:text-6xl">Finish a workout. Your plan already knows.</h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">Connect Strava once. Every ride, run, and swim flows back into your plan. Completed sessions check themselves off and weekly volume updates in real time.</p>
            <button type="button" onClick={goStrava} className="mt-7 inline-flex rounded-md transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#FFE7DD]" aria-label="Connect with Strava"><img src={connectStrava} alt="Connect with Strava" className="h-12 w-auto" /></button>
          </div>
          <div className="lg:col-span-6 lg:order-1"><StravaCard /></div>
        </div>
      </section>

      <section id="adjustments" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="rounded-[2rem] border border-[#E3E0D8] bg-[#101114] p-6 text-white shadow-[0_24px_80px_rgba(16,17,20,0.16)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Coach insight</p>
              <h3 className="mt-4 text-3xl font-black tracking-[-0.06em]">Good week. Keep the next one realistic.</h3>
              <p className="mt-4 text-base leading-7 text-white/65">You completed the key run and two steady rides. This week keeps the long ride controlled, then rebuilds run volume without forcing intensity.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">{['View adjusted week', 'Ask coach', 'Open Saturday'].map((item) => <div key={item} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/85">{item}</div>)}</div>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <Label>Weekly adjustments</Label>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] md:text-6xl">When training changes, your plan changes.</h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">Miss a long ride, crush a key run, or have a lighter week than planned. TrainGPT reads the week and updates what comes next.</p>
          </div>
        </div>
      </section>

      <section className="bg-[#101114] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40">Start training</p><h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.07em] md:text-6xl">Build your triathlon plan today.</h2></div>
          <button type="button" onClick={goPlan} className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#101114] transition hover:bg-white/90">{authed ? 'Open plan builder' : 'Build my free plan'}</button>
        </div>
      </section>

      <section id="resources" className="bg-white"><BlogPreview /></section>
      <Footer />
    </main>
  );
}
