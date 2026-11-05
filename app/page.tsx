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

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#635BFF]">{children}</p>;
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
                ['5/6', 'sessions'],
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
            <span className="text-xl font-black tracking-[-0.075em] text-[#101114]">TrainGPT</span>
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
              {authed ? 'Open plan builder' : 'Build my free plan'}
            </button>
          </div>
        </div>
      </header>

      <section className="relative isolate px-4 pb-16 pt-32 text-center sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-16 -z-10 h-[620px] w-[920px] -translate-x-1/2 rounded-full bg-[#E8E3FF] opacity-75 blur-3xl" />
        <div className="absolute right-0 top-40 -z-10 h-[380px] w-[380px] rounded-full bg-[#FFE7DD] opacity-70 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <Label>AI coaching for runners &amp; triathletes</Label>
          <h1 className="mx-auto mt-7 max-w-5xl text-[clamp(2.7rem,8vw,7.1rem)] font-black leading-[0.95] tracking-[-0.085em]">
            Endurance training,<br />
            <span className="bg-gradient-to-r from-[#4F63F5] via-[#7C5CF0] to-[#9B5CE8] bg-clip-text text-transparent">on autopilot.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[#4B5563] sm:text-xl sm:leading-8">
            Build a plan around your race, connect Strava, and let TrainGPT adapt your training to what you actually do.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={goPrimary} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#101114] px-7 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,17,20,0.16)] transition hover:bg-[#25272D]">
              {authed ? 'Open plan builder' : 'Build my free plan'}
            </button>
            <a href="#how" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-black text-[#101114] transition hover:bg-[#F7F6F2]">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#6B7280]">Running from 5K to marathon. Triathlon from sprint to full distance.</p>
          <div className="mt-6 flex justify-center">
            <img src={compatibleStrava} alt="Compatible with Strava" className="h-auto w-[220px] max-w-full" />
          </div>
          <HeroPreview />
        </div>
      </section>

      <section id="how" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <Label>The training loop</Label>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-5xl">Built for the weeks that don’t go to plan.</h2>
            <p className="mt-4 text-base leading-7 text-[#6B7280]">A schedule is just the starting point. TrainGPT stays useful after the first workout.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ProductCard eyebrow="01 / Plan" title="Start with your race." body="Choose your goal, current fitness, and available time. Get a real training build—not a generic week." />
            <ProductCard eyebrow="02 / Track" title="Your workouts sync." body="Connect Strava and see completed swims, rides, and runs next to the sessions you planned." />
            <ProductCard eyebrow="03 / Adapt" title="Know what changes." body="For triathlon plans, completed training informs the next week, with a clear explanation of what changed." />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-[#8A8F98]">
            <span className="mr-2">Built for</span>
            {['5K', 'Marathon', 'Sprint', '70.3', '140.6'].map((distance) => <span key={distance} className="rounded-full border border-[#E3E0D8] bg-white px-4 py-2">{distance}</span>)}
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
          <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Why TrainGPT exists</p><h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.07em] sm:text-6xl">More useful than copy-pasting a plan into ChatGPT.</h2><p className="mt-5 max-w-2xl text-base leading-8 text-white/65">The intelligence can sit in the engine room. What matters to the athlete is that the plan remembers the race, sees completed training, keeps the schedule in one place, and explains what changed.</p></div>
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6"><p className="text-sm font-black">Built by a triathlete who got tired of rebuilding context every time.</p><p className="mt-3 text-sm leading-6 text-white/60">TrainGPT does not pretend to replace a great human coach. It is meant to make structured, adaptive training accessible when a coach is not the right option.</p><a href="/about" className="mt-5 inline-flex text-sm font-black underline underline-offset-4">Read the story</a></div>
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
        <div className="mx-auto max-w-4xl text-center"><Label>Free today</Label><h2 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-5xl">No credit card. No hidden activation wall.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#6B7280]">TrainGPT is free while we build it with athletes. You can preview the product before signing up, and the saved product is designed for the full race build rather than a disposable PDF.</p><button type="button" onClick={goPrimary} className="mt-7 rounded-full bg-[#101114] px-6 py-3 text-sm font-black text-white">{authed ? 'Open TrainGPT' : 'Preview my plan'}</button></div>
      </section>

      <section id="resources" className="bg-white"><BlogPreview /></section>
      <Footer />
    </main>
  );
}
