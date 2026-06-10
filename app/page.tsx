'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

const SWIM_IMAGE =
  'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1800&q=85';
const BIKE_IMAGE =
  'https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=1800&q=85';
const RUN_IMAGE =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1800&q=85';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
      {children}
    </p>
  );
}

function MarketingHeader({
  authed,
  onStart,
  onSchedule,
}: {
  authed: boolean;
  onStart: () => void;
  onSchedule: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { href: '#schedule', label: 'Schedule' },
    { href: '#tracking', label: 'Strava' },
    { href: '#coaching', label: 'Coaching' },
    { href: '#resources', label: 'Resources' },
  ];

  const ctaLabel = authed ? 'Open plan' : 'Sign in to generate plan';

  return (
    <header
      className={cx(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-zinc-200 bg-white/90 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="group flex items-center gap-3"
          aria-label="Go to top"
        >
          <span className="text-sm font-semibold tracking-tight text-zinc-950">TrainGPT</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg text-zinc-950 md:hidden"
            aria-label="Open navigation"
          >
            {open ? '×' : '≡'}
          </button>

          <button
            type="button"
            onClick={authed ? onSchedule : onStart}
            className="hidden rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:inline-flex"
          >
            {ctaLabel}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-zinc-200 bg-white px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={authed ? onSchedule : onStart}
              className="mt-2 rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function PlanGeneratorCard({ authed, onStart }: { authed: boolean; onStart: () => void }) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onStart();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Plan generator</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Start with your race.</h2>
        </div>
        <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">~60 sec</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Race</span>
          <select
            defaultValue="70.3"
            className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-400"
          >
            <option value="Sprint">Sprint</option>
            <option value="Olympic">Olympic</option>
            <option value="70.3">70.3</option>
            <option value="Ironman">Ironman</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Race date</span>
          <input
            type="date"
            className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-400"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Experience</span>
          <select
            defaultValue="Intermediate"
            className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-400"
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Weekly hours</span>
          <input
            defaultValue="8"
            inputMode="numeric"
            className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-400"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-zinc-500">Optional note</span>
        <textarea
          rows={3}
          placeholder="I prefer long rides Saturday, long runs Sunday, and one rest day."
          className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        {authed ? 'Open plan' : 'Sign in to generate plan'}
      </button>

      <p className="mt-4 text-center text-xs text-zinc-500">
        {authed
          ? 'Open your plan generator to create or update your training block.'
          : 'Create an account first. Your plan is generated inside the app.'}
      </p>
    </form>
  );
}

function ImagePanel({ image, label, title }: { image: string; label: string; title: string }) {
  return (
    <div className="group relative min-h-[340px] overflow-hidden rounded-[2rem] bg-zinc-200 md:min-h-[500px]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">{label}</p>
        <h3 className="mt-3 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{title}</h3>
      </div>
    </div>
  );
}

function SchedulePreview() {
  const sessions = [
    ['Mon', 'Swim', '2,000m technique', 'Done'],
    ['Tue', 'Bike', '75min endurance', 'Planned'],
    ['Thu', 'Run', '45min threshold', 'Key'],
    ['Sat', 'Brick', 'Bike + run transition', 'Planned'],
  ];

  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Schedule</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Know what to train next</h3>
        </div>
        <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">Week view</span>
      </div>
      <div className="mt-4 space-y-2">
        {sessions.map(([day, sport, title, status]) => (
          <div key={`${day}-${sport}`} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/70 px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="w-9 text-xs font-medium text-zinc-400">{day}</span>
              <span className="h-2 w-2 rounded-full bg-zinc-950" />
              <div>
                <p className="text-sm font-medium text-zinc-950">{sport}</p>
                <p className="text-xs text-zinc-500">{title}</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200">
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Start with your race.',
      copy: 'Choose your distance, race date, weekly training hours, experience, and the constraints that matter.',
    },
    {
      number: '02',
      title: 'Get a structured calendar.',
      copy: 'Your plan balances swim, bike, run, recovery, long sessions, and race-specific work in a simple weekly schedule.',
    },
    {
      number: '03',
      title: 'Track what actually happened.',
      copy: 'Sync completed workouts, compare them to the plan, and use weekly guidance to stay consistent.',
    },
  ];

  return (
    <section id="how-it-works" className="border-t border-zinc-200 bg-[#fbfaf8] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
            From blank calendar to race-ready structure.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium text-zinc-400">{step.number}</p>
              <h3 className="mt-10 text-xl font-semibold tracking-tight text-zinc-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{step.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: SupabaseSession | null) => {
        if (!alive) return;
        setSession(nextSession ?? null);
      }
    );

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const authed = !!session?.user;

  const startPlan = () => {
    if (authed) {
      router.push('/plan');
      return;
    }

    router.push(`/login?next=${encodeURIComponent('/plan')}`);
  };

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <MarketingHeader authed={authed} onStart={startPlan} onSchedule={() => router.push('/schedule')} />

      <section className="relative overflow-hidden bg-[#fbfaf8] px-4 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 pb-24 lg:grid-cols-12 lg:pb-32">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
              Personalized triathlon planning
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-zinc-950 sm:text-6xl lg:text-7xl">
              A plan that adapts every week to what you actually did.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">
              Generate your full swim, bike, and run schedule from your race and Strava history in seconds. Then every Sunday, your coach reviews what you actually trained and rewrites the week ahead.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={startPlan}
                className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                {authed ? 'Open plan' : 'Sign in to generate plan'}
              </button>
              <a
                href="#how-it-works"
                className="rounded-full border border-zinc-200 bg-white px-6 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                See how it works
              </a>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-zinc-200 pt-6">
              <div>
                <p className="text-2xl font-semibold">4</p>
                <p className="mt-1 text-xs text-zinc-500">Race distances</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">3</p>
                <p className="mt-1 text-xs text-zinc-500">Sports balanced</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">1</p>
                <p className="mt-1 text-xs text-zinc-500">Clear calendar</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <PlanGeneratorCard authed={authed} onStart={startPlan} />
          </div>
        </div>
      </section>

      <section className="bg-[#fbfaf8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <ImagePanel image={SWIM_IMAGE} label="Swim" title="Build technique and endurance without guessing what belongs in the week." />
          <ImagePanel image={BIKE_IMAGE} label="Bike" title="Structure your long rides, bricks, and intensity around the race you actually have." />
          <ImagePanel image={RUN_IMAGE} label="Run" title="Progress the run safely while balancing the fatigue of swim and bike training." />
        </div>
      </section>

      <HowItWorks />

      <section id="schedule" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>Training calendar</SectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              Know exactly what to train each day.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              Every generated plan becomes a simple calendar with daily sessions, detailed workout generation, completion tracking, and Strava activity overlays.
            </p>
          </div>
          <div className="lg:col-span-7">
            <SchedulePreview />
          </div>
        </div>
      </section>

      <section id="tracking" className="border-y border-zinc-200 bg-[#fbfaf8] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>Strava-connected tracking</SectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              See the plan and the work side by side.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              Completed activities appear alongside your planned sessions so you can see what was done, what changed, and where consistency is building.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Completed work</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">This week</h3>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-100">Strava synced</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['Bike', '6h 15m', '2 sessions'],
                  ['Run', '2h 10m', '3 sessions'],
                  ['Swim', '2h 45m', '2 sessions'],
                ].map(([sport, time, detail]) => (
                  <div key={sport} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs text-zinc-400">{sport}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{time}</p>
                    <p className="mt-1 text-xs text-zinc-500">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="coaching" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Weekly guidance</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
                Understand the week before you move on to the next one.
              </h3>
              <div className="mt-6 space-y-3">
                {[
                  'Time trained: 8h 45m this week.',
                  'Key sessions: threshold run, long ride, long run.',
                  'Sunday check-in: rate the week and leave notes for your coach.',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <SectionLabel>Coaching guidance</SectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              Review, adjust, and stay consistent.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              Use weekly summaries and session feedback to understand what went well, what changed, and what needs attention before the next training week.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/50">Start training</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              Build your next race plan in seconds.
            </h2>
          </div>
          <button
            type="button"
            onClick={startPlan}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
          >
            {authed ? 'Open plan' : 'Sign in to generate plan'}
          </button>
        </div>
      </section>

      <section id="resources" className="bg-white">
        <BlogPreview />
      </section>

      <Footer />
    </main>
  );
}
