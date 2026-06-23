'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7182FF] via-[#7C5CF0] to-[#A855F7] shadow-[0_12px_28px_rgba(124,92,240,0.28)]">
      <span className="h-3.5 w-3.5 rounded-md bg-white" />
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#635BFF]">{children}</p>;
}

function PillButton({ children, onClick, variant = 'dark' }: { children: ReactNode; onClick?: () => void; variant?: 'dark' | 'light' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === 'dark'
          ? 'inline-flex min-h-12 items-center justify-center rounded-full bg-[#101114] px-6 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,17,20,0.18)] transition hover:-translate-y-0.5 hover:bg-[#25272D]'
          : 'inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-black text-[#101114] transition hover:-translate-y-0.5 hover:bg-[#F7F6F2]'
      }
    >
      {children}
    </button>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute inset-x-0 top-12 -z-10 mx-auto h-[360px] max-w-5xl rounded-[3rem] bg-gradient-to-r from-[#DAD4FF] via-[#EDEBFF] to-[#FFE5D9] opacity-70 blur-3xl" />
      <div className="overflow-hidden rounded-[2.15rem] border border-[#E3E0D8] bg-white/85 p-4 text-left shadow-[0_32px_100px_rgba(16,17,20,0.14)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 px-3 pb-3 pt-1 text-xs font-bold text-[#7C7E86] sm:flex-row sm:items-center sm:justify-between">
          <span>TrainGPT · This week</span>
          <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#CDEFD9] bg-[#F0FBF4] px-3 py-1.5 text-xs font-black text-[#0C7A55]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
            Strava synced
          </span>
        </div>

        <div className="grid gap-4 rounded-[1.6rem] border border-[#EEECE6] bg-[#F7F7F5] p-3 lg:grid-cols-[1fr_1.03fr]">
          <div className="rounded-[1.4rem] border border-[#E8E5DD] bg-white p-5 shadow-[0_10px_35px_rgba(16,17,20,0.05)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9CA3AF]">Santa Cruz 70.3</p>
                <h3 className="mt-1 text-2xl font-black tracking-[-0.055em] text-[#101114]">Race in 91 days</h3>
              </div>
              <span className="rounded-full bg-[#F0FBF4] px-3 py-1.5 text-xs font-black text-[#0C7A55]">On track</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['86%', 'adherence'],
                ['7.8h', 'this week'],
                ['42', 'readiness'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-[#F7F7F5] p-4">
                  <p className="text-2xl font-black tracking-[-0.06em] text-[#101114]">{value}</p>
                  <p className="mt-1 text-xs font-bold text-[#7D7E86]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex h-32 items-end gap-2 rounded-3xl border border-[#EEECE6] bg-gradient-to-b from-white to-[#F3F3F1] px-4 pb-4 pt-6">
              {[
                ['46%', '#22C55E'],
                ['58%', '#22C55E'],
                ['72%', '#7C5CF0'],
                ['34%', '#D9D9DF'],
                ['50%', '#F59E0B'],
                ['88%', '#7C5CF0'],
                ['64%', '#7C5CF0'],
              ].map(([height, color], index) => (
                <div key={`${height}-${index}`} className="min-w-0 flex-1 rounded-t-full rounded-b-lg" style={{ height, backgroundColor: color }} />
              ))}
            </div>

            <div className="mt-4 flex gap-3 rounded-3xl border border-[#DAD4FF] bg-[#F1EFFF] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F63F5] to-[#7C5CF0] text-base font-black text-white">↻</span>
              <div>
                <p className="text-sm font-black text-[#4047BD]">Weekly adjustment ready</p>
                <p className="mt-1 text-sm leading-6 text-[#666872]">You missed Saturday's long ride. TrainGPT moved it to Sunday and eased Monday so the week still works.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-[#E8E5DD] bg-white p-5 shadow-[0_10px_35px_rgba(16,17,20,0.05)]">
            <div className="relative min-h-56 overflow-hidden rounded-[1.4rem] bg-[#101114] p-5 text-white">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#7C5CF0]/50 blur-3xl" />
              <div className="relative">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">Today's workout</p>
                <h3 className="mt-12 text-3xl font-black leading-none tracking-[-0.06em]">Bike threshold intervals</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">75 minutes with 4 x 8 minutes at threshold. Build power while keeping tomorrow's run intact.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['75 min', '4 x 8 min', 'Z4 power', 'Key session'].map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white/80">{item}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                ['Swim', 'Technique swim', '1,800 yd. Drills and easy aerobic work.', 'Done'],
                ['Run', 'Easy brick run', '25 min. Relaxed off the bike.', 'Tomorrow'],
              ].map(([sport, title, meta, tag]) => (
                <div key={title} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-3xl border border-[#E3E0D8] bg-white p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F4F0] text-[10px] font-black uppercase tracking-[0.1em] text-[#6B7280]">{sport}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">{title}</p>
                    <p className="mt-1 truncate text-sm text-[#6B7280]">{meta}</p>
                  </div>
                  <span className="rounded-full bg-[#F1EFFF] px-3 py-1 text-[11px] font-black text-[#635BFF]">{tag}</span>
                </div>
              ))}
            </div>
          </div>
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
              <p className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">{day}. {title}</p>
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
      <img src={compatibleStrava} alt="Compatible with Strava" className="mb-4 h-auto w-[210px] max-w-full" />
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
        <p className="mt-1 text-sm leading-6 text-[#4F4A70]">Completed sessions match automatically and keep weekly load current.</p>
      </div>
    </div>
  );
}

function AdjustmentCard() {
  return (
    <div className="rounded-[2rem] border border-[#E3E0D8] bg-white p-6 shadow-[0_28px_90px_rgba(16,17,20,0.10)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9CA3AF]">16 week plan</p>
          <h3 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#101114]">Base, Build, Peak, Taper, Race</h3>
        </div>
        <span className="w-fit rounded-full bg-[#F0FBF4] px-3 py-1.5 text-xs font-black text-[#0C7A55]">Adjusted weekly</span>
      </div>

      <div className="mt-8 flex items-center gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <span
            key={item}
            className="h-3 flex-1 rounded-full"
            style={{
              backgroundColor: item < 2 ? '#B7C0FF' : item < 5 ? '#7C5CF0' : item === 5 ? '#F59E0B' : '#22C55E',
              flexGrow: item === 6 ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-between text-xs font-bold text-[#85868E]">
        <span>Base</span>
        <span>Build</span>
        <span>Peak</span>
        <span>Taper</span>
        <span>Race</span>
      </div>

      <div className="mt-6 grid gap-3">
        {[
          'Protects long rides, long runs, and race-specific brick sessions.',
          'Lightens the next day when training load comes in high.',
          'Moves missed sessions when useful. Skips them when it is smarter.',
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666872]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E9F8EF] text-xs font-black text-[#0C7A55]">✓</span>
            <span>{item}</span>
          </div>
        ))}
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
    <main className="min-h-screen overflow-hidden bg-[#FBFBFA] text-[#101114]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E3E0D8]/70 bg-[#FBFBFA]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3" aria-label="Go to top">
            <Mark />
            <span className="text-sm font-black tracking-[-0.03em]">TrainGPT</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-2 text-sm font-semibold text-[#6B7280] transition hover:bg-white hover:text-[#101114]">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={authed ? goSchedule : goLogin} className="rounded-full border border-[#E2E0D8] bg-white px-4 py-2 text-sm font-bold text-[#101114] transition hover:bg-[#F7F6F2]">
              {authed ? 'Open app' : 'Log in'}
            </button>
            <button type="button" onClick={authed ? goSchedule : goPlan} className="rounded-full bg-[#101114] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#25272D]">
              {authed ? 'Open schedule' : 'Build my plan'}
            </button>
          </div>
        </div>
      </header>

      <section className="relative isolate px-4 pb-16 pt-32 text-center sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-16 -z-10 h-[620px] w-[920px] -translate-x-1/2 rounded-full bg-[#E8E3FF] opacity-75 blur-3xl" />
        <div className="absolute right-0 top-40 -z-10 h-[380px] w-[380px] rounded-full bg-[#FFE7DD] opacity-70 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <Label>Free AI triathlon coaching</Label>
          <h1 className="mx-auto mt-7 max-w-5xl text-[4.2rem] font-black leading-[0.92] tracking-[-0.085em] sm:text-[6.2rem] lg:text-[7.3rem]">
            Triathlon training,
            <br />
            <span className="bg-gradient-to-r from-[#4F63F5] via-[#7C5CF0] to-[#9B5CE8] bg-clip-text text-transparent">on autopilot.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#4B5563] sm:text-xl">
            TrainGPT builds your race plan, reads your Strava training, and adjusts the week ahead when life gets in the way.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <PillButton onClick={goPlan}>{authed ? 'Open plan builder' : 'Build my plan'}</PillButton>
            <a href="#strava" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-black text-[#101114] transition hover:-translate-y-0.5 hover:bg-[#F7F6F2]">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#6B7280]">Sprint, Olympic, 70.3, and Ironman plans. Built in about 60 seconds.</p>
          <div className="mt-7 flex justify-center">
            <img src={compatibleStrava} alt="Compatible with Strava" className="h-auto w-[220px] max-w-full" />
          </div>

          <HeroPreview />
        </div>
      </section>

      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 px-4 pb-14 text-sm sm:px-6 lg:px-8">
        <span className="mr-1 font-bold text-[#8A8F98]">Built for</span>
        {races.map((race) => (
          <span key={race} className="rounded-full border border-[#E3E0D8] bg-white px-4 py-2 font-black text-[#8A8F98] shadow-[0_8px_30px_rgba(16,17,20,0.03)]">
            {race}
          </span>
        ))}
      </div>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3">
          {[
            ['Free', 'To generate'],
            ['60s', 'To a custom plan'],
            ['Weekly', 'Adjusted with Strava'],
          ].map(([value, label]) => (
            <div key={value} className="rounded-[1.75rem] border border-[#E3E0D8] bg-white/70 p-8 text-center shadow-[0_18px_60px_rgba(16,17,20,0.05)]">
              <p className="text-5xl font-black tracking-[-0.08em] text-[#635BFF]">{value}</p>
              <p className="mt-3 text-sm font-black text-[#6B7280]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="calendar" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Label>Calendar-first coaching</Label>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] md:text-6xl">Your plan, laid out like real life.</h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">Open TrainGPT and the day is clear. Distance, zones, and intent are already there. No spreadsheets. No guessing. Just the next session.</p>
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
            <button type="button" onClick={goStrava} className="mt-7 inline-flex rounded-md transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#FFE7DD]" aria-label="Connect with Strava">
              <img src={connectStrava} alt="Connect with Strava" className="h-12 w-auto" />
            </button>
          </div>
          <div className="lg:col-span-6 lg:order-1"><StravaCard /></div>
        </div>
      </section>

      <section id="adjustments" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Label>Adaptive training</Label>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] md:text-6xl">Miss a session. Keep the plan moving.</h2>
          <p className="mt-5 text-base leading-8 text-[#4B5563]">TrainGPT adjusts the days ahead around what you actually did. Key sessions stay protected. Recovery stays respected.</p>
        </div>
        <div className="mx-auto mt-12 max-w-5xl"><AdjustmentCard /></div>
      </section>

      <section className="mx-auto mb-20 mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-[#E3E0D8] bg-white p-10 text-center shadow-[0_28px_90px_rgba(16,17,20,0.08)] md:p-16">
          <Label>Start training</Label>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black leading-none tracking-[-0.07em] md:text-6xl">Build your race plan before your next workout.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#4B5563]">Set your race, schedule, experience, and available hours. TrainGPT builds the plan, tracks your work, and adjusts the week ahead.</p>
          <div className="mt-8">
            <PillButton onClick={goPlan}>{authed ? 'Open plan builder' : 'Build my plan'}</PillButton>
          </div>
        </div>
      </section>

      <section id="resources" className="bg-white"><BlogPreview /></section>
      <Footer />
    </main>
  );
}
