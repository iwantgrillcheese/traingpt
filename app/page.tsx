'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';

type PlanInputs = {
  raceType: string;
  raceDate: string;
  experience: string;
  maxHours: string;
  restDay: string;
  userNote: string;
  bikeFTP: string;
  runPace: string;
  swimPace: string;
};

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85';
const SWIM_IMAGE =
  'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1800&q=85';
const BIKE_IMAGE =
  'https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=1800&q=85';
const RUN_IMAGE =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1800&q=85';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function resolvePlanPath(inputs: PlanInputs) {
  const params = new URLSearchParams();

  if (inputs.raceType) params.set('raceType', inputs.raceType);
  if (inputs.raceDate) params.set('raceDate', inputs.raceDate);
  if (inputs.experience) params.set('experience', inputs.experience);
  if (inputs.maxHours) params.set('maxHours', inputs.maxHours);
  if (inputs.restDay) params.set('restDay', inputs.restDay);
  if (inputs.userNote) params.set('userNote', inputs.userNote);
  if (inputs.bikeFTP) params.set('bikeFTP', inputs.bikeFTP);
  if (inputs.runPace) params.set('runPace', inputs.runPace);
  if (inputs.swimPace) params.set('swimPace', inputs.swimPace);

  const query = params.toString();
  return query ? `/plan?${query}` : '/plan';
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
    { href: '#plan', label: 'Plan' },
    { href: '#schedule', label: 'Schedule' },
    { href: '#coaching', label: 'Coaching' },
    { href: '#resources', label: 'Resources' },
  ];

  return (
    <header
      className={cx(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-black/10 bg-white/85 backdrop-blur-xl' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="group flex items-center gap-3"
          aria-label="Go to top"
        >
          <span
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              scrolled ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-950'
            )}
          >
            T
          </span>
          <span className={cx('text-sm font-semibold tracking-tight', scrolled ? 'text-zinc-950' : 'text-white')}>
            TrainGPT
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cx(
                'rounded-full px-3 py-2 text-sm transition-colors',
                scrolled ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950' : 'text-white/75 hover:bg-white/10 hover:text-white'
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={cx(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg md:hidden',
              scrolled ? 'border-zinc-200 bg-white text-zinc-950' : 'border-white/20 bg-white/10 text-white'
            )}
            aria-label="Open navigation"
          >
            {open ? '×' : '≡'}
          </button>

          <button
            type="button"
            onClick={authed ? onSchedule : onStart}
            className={cx(
              'hidden rounded-full px-4 py-2 text-sm font-medium transition-colors sm:inline-flex',
              scrolled ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-white text-zinc-950 hover:bg-white/90'
            )}
          >
            {authed ? 'Open schedule' : 'Generate plan'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-black/10 bg-white px-4 py-3 md:hidden">
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
              {authed ? 'Open schedule' : 'Generate plan'}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function PlanGeneratorCard({
  inputs,
  setInputs,
  onSubmit,
}: {
  inputs: PlanInputs;
  setInputs: React.Dispatch<React.SetStateAction<PlanInputs>>;
  onSubmit: () => void;
}) {
  const update = (key: keyof PlanInputs, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div id="plan" className="rounded-[2rem] border border-white/20 bg-white/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur md:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Plan generator</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Start with your race.</h2>
        </div>
        <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">~60 sec</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">Race</span>
          <select
            value={inputs.raceType}
            onChange={(e) => update('raceType', e.target.value)}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
          >
            <option>Sprint</option>
            <option>Olympic</option>
            <option>70.3</option>
            <option>Ironman</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">Race date</span>
          <input
            type="date"
            value={inputs.raceDate}
            onChange={(e) => update('raceDate', e.target.value)}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">Experience</span>
          <select
            value={inputs.experience}
            onChange={(e) => update('experience', e.target.value)}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">Weekly hours</span>
          <input
            type="number"
            min="3"
            max="24"
            value={inputs.maxHours}
            onChange={(e) => update('maxHours', e.target.value)}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
          />
        </label>
      </div>

      <label className="mt-3 block space-y-1.5">
        <span className="text-xs font-medium text-zinc-500">Optional note</span>
        <textarea
          rows={3}
          value={inputs.userNote}
          onChange={(e) => update('userNote', e.target.value)}
          placeholder="I prefer long rides Saturday, long runs Sunday, and one rest day."
          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950"
        />
      </label>

      <button
        type="button"
        onClick={onSubmit}
        className="mt-4 h-12 w-full rounded-full bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        Generate my plan
      </button>

      <p className="mt-3 text-center text-xs text-zinc-500">
        Personalized around your race, schedule, and current fitness.
      </p>
    </div>
  );
}

function ProductCard() {
  const sessions = [
    ['Mon', 'Swim', '2,000m technique', 'Done'],
    ['Tue', 'Bike', '75min endurance', 'Planned'],
    ['Wed', 'Run', '45min tempo', 'Planned'],
    ['Sat', 'Brick', 'Bike + run transition', 'Key'],
  ];

  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Week 8 · Build</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Race week clarity</h3>
        </div>
        <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">Strava synced</span>
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

function ImagePanel({ image, label, title }: { image: string; label: string; title: string }) {
  return (
    <div className="group relative min-h-[360px] overflow-hidden rounded-[2rem] bg-zinc-200 md:min-h-[520px]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">{label}</p>
        <h3 className="mt-3 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{title}</h3>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Tell us the race.',
      copy: 'Choose your distance, race date, weekly hours, experience, and any constraints that matter.',
    },
    {
      number: '02',
      title: 'Generate the plan.',
      copy: 'TrainGPT builds a periodized swim, bike, and run schedule with recovery, long sessions, and key bricks.',
    },
    {
      number: '03',
      title: 'Train with feedback.',
      copy: 'Follow the calendar, sync Strava, generate detailed workouts, and ask your coach what to adjust.',
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
  const [inputs, setInputs] = useState<PlanInputs>({
    raceType: '70.3',
    raceDate: '',
    experience: 'Intermediate',
    maxHours: '8',
    restDay: '',
    userNote: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
  });

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
  const planPath = useMemo(() => resolvePlanPath(inputs), [inputs]);

  const startPlan = () => {
    if (authed) {
      router.push(planPath);
      return;
    }

    router.push(`/login?next=${encodeURIComponent(planPath)}`);
  };

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <MarketingHeader authed={authed} onStart={startPlan} onSchedule={() => router.push('/schedule')} />

      <section className="relative min-h-screen overflow-hidden bg-zinc-950 pt-16 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fbfaf8] to-transparent" />

        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/65">
              AI triathlon planning
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Your triathlon training plan, generated in seconds.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
              Build a personalized swim, bike, and run plan around your race, schedule, and fitness. Then follow it with Strava-connected tracking and coach guidance.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={startPlan}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
              >
                Generate your plan
              </button>
              <a
                href="#how-it-works"
                className="rounded-full border border-white/25 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/20 pt-6">
              <div>
                <p className="text-2xl font-semibold">4</p>
                <p className="mt-1 text-xs text-white/60">Race distances</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">3</p>
                <p className="mt-1 text-xs text-white/60">Sports balanced</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">1</p>
                <p className="mt-1 text-xs text-white/60">Clear calendar</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <PlanGeneratorCard inputs={inputs} setInputs={setInputs} onSubmit={startPlan} />
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
            <ProductCard />
          </div>
        </div>
      </section>

      <section id="coaching" className="border-y border-zinc-200 bg-[#fbfaf8] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Coach brief</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
                This week: keep the bike aerobic and protect the long run.
              </h3>
              <div className="mt-6 space-y-3">
                {[
                  'Key session: Saturday 90min endurance ride with short tempo blocks.',
                  'Risk: avoid turning easy runs into threshold efforts.',
                  'Adjustment: if fatigue is high, shorten Friday swim by 400m.',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <SectionLabel>AI coaching</SectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              Get clarity when training gets messy.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              Ask why a workout matters, how to adjust after a missed session, or what to focus on this week. TrainGPT keeps the guidance connected to your actual plan.
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
            Generate your plan
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
