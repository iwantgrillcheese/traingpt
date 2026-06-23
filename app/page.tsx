"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthChangeEvent,
  Session as SupabaseSession,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import Footer from "./components/footer";
import BlogPreview from "./components/blog/BlogPreview";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2563FF]">
      {children}
    </p>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#2563FF] text-[15px] font-black tracking-[-0.08em] text-white shadow-[0_12px_30px_rgba(37,99,255,0.24)]"
    >
      TG
    </span>
  );
}

function CTAButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black transition duration-200",
        variant === "primary"
          ? "bg-[#2563FF] text-white shadow-[0_18px_40px_rgba(37,99,255,0.24)] hover:-translate-y-0.5 hover:bg-[#184FE0]"
          : "border border-[#E2E0D8] bg-white text-[#101114] hover:border-[#CFCBC1] hover:bg-[#F7F6F2]",
      )}
    >
      {children}
    </button>
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
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#plan-preview", label: "Plan preview" },
    { href: "#strava", label: "Strava" },
    { href: "#coaching", label: "Weekly adjustments" },
  ];

  const handlePrimary = authed ? onSchedule : onStart;

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[#E3E0D8] bg-[#F7F6F2]/90 shadow-[0_12px_40px_rgba(16,17,20,0.05)] backdrop-blur-xl"
          : "bg-[#F7F6F2]/70 backdrop-blur-xl",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-3"
          aria-label="Go to top"
        >
          <BrandMark />
          <span className="text-sm font-black tracking-[-0.03em] text-[#101114]">
            TrainGPT
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-[#6B7280] transition hover:bg-white hover:text-[#101114]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E3E0D8] bg-white text-lg font-semibold text-[#101114] md:hidden"
            aria-label="Open navigation"
          >
            {open ? "×" : "≡"}
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            className="hidden rounded-full bg-[#101114] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#25272D] sm:inline-flex"
          >
            {authed ? "Open app" : "Generate plan"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[#E3E0D8] bg-[#F7F6F2] px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-[#4B5563] hover:bg-white"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handlePrimary}
              className="mt-2 rounded-full bg-[#2563FF] px-4 py-3 text-sm font-bold text-white"
            >
              {authed ? "Open app" : "Generate plan"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeroProductCard() {
  const sessions = [
    ["Tue", "Swim technique", "50 min · 2,100m", "#0E8FA0", "Done"],
    ["Wed", "Easy run", "45 min · Z2", "#101114", "Synced"],
    ["Thu", "Bike endurance", "75 min · 135–155W", "#FF6A00", "Today"],
    ["Sat", "Long ride", "2h 30m · fueling practice", "#FF6A00", "Key"],
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#C6F33C]/70 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#2563FF]/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-white p-5 shadow-[0_36px_90px_rgba(16,17,20,0.16)]">
        <div className="rounded-[1.75rem] bg-[#101114] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
            Generated plan
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.05em]">
            Santa Cruz 70.3 build
          </h3>
          <p className="mt-2 max-w-[22rem] text-sm leading-6 text-white/65">
            Free custom plan generated for your race. Track the work, then
            adjust the next week.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["7h 20m", "planned"],
              ["4 / 7", "complete"],
              ["3", "Strava synced"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-3xl bg-white/10 p-4">
                <div className="text-2xl font-black tracking-[-0.06em]">
                  {value}
                </div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {sessions.map(([day, title, meta, color, status]) => (
            <div
              key={`${day}-${title}`}
              className="flex items-center gap-3 rounded-3xl border border-[#E3E0D8] bg-white px-4 py-3"
            >
              <div className="w-10 text-xs font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
                {day}
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">
                  {title}
                </div>
                <div className="mt-0.5 text-xs font-medium text-[#6B7280]">
                  {meta}
                </div>
              </div>
              <div className="rounded-full bg-[#EAF0FF] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#2563FF]">
                {status}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#C9D6FF] bg-[#EAF0FF] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2563FF]" />
            <div>
              <p className="text-sm font-black tracking-[-0.02em] text-[#101114]">
                Weekly adjustment
              </p>
              <p className="mt-1 text-sm leading-6 text-[#46506A]">
                3 Strava activities matched this week. Missed the long ride? We
                adjust the next week around it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanGeneratorCard({
  authed,
  onStart,
}: {
  authed: boolean;
  onStart: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onStart();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white bg-white p-5 shadow-[0_24px_80px_rgba(16,17,20,0.10)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#E3E0D8] pb-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563FF]">
            Plan generator
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#101114]">
            Build your free plan.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
            Tell TrainGPT your race, schedule, and training time. Get a custom
            plan in seconds.
          </p>
        </div>
        <span className="rounded-full bg-[#C6F33C] px-3 py-1 text-xs font-black text-[#101114]">
          ~60 sec
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-[#6B7280]">Race</span>
          <select
            defaultValue="70.3"
            className="mt-2 h-12 w-full rounded-2xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#101114] outline-none transition focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]"
          >
            <option value="Sprint">Sprint</option>
            <option value="Olympic">Olympic</option>
            <option value="70.3">70.3</option>
            <option value="Ironman">Ironman</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-[#6B7280]">Race date</span>
          <input
            type="date"
            className="mt-2 h-12 w-full rounded-2xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#101114] outline-none transition focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-[#6B7280]">Experience</span>
          <select
            defaultValue="Intermediate"
            className="mt-2 h-12 w-full rounded-2xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#101114] outline-none transition focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]"
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-[#6B7280]">Weekly hours</span>
          <input
            defaultValue="8"
            inputMode="numeric"
            className="mt-2 h-12 w-full rounded-2xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#101114] outline-none transition focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]"
          />
        </label>
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-[#F7F6F2] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[#101114]">Preview</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2563FF]">
            Trackable
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-[#6B7280]">
          <div className="flex justify-between">
            <span>Plan length</span>
            <b className="text-[#101114]">16 weeks</b>
          </div>
          <div className="flex justify-between">
            <span>Weekly rhythm</span>
            <b className="text-[#101114]">Swim · Bike · Run</b>
          </div>
          <div className="flex justify-between">
            <span>Training data</span>
            <b className="text-[#101114]">Strava sync</b>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-[#2563FF] px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(37,99,255,0.24)] transition hover:bg-[#184FE0]"
      >
        {authed ? "Open plan builder" : "Generate my free plan"}
      </button>
      <p className="mt-4 text-center text-xs font-medium text-[#6B7280]">
        Create your plan, save it, then track training through race day.
      </p>
    </form>
  );
}

function ValueCard({
  eyebrow,
  title,
  copy,
  accent,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-[#E3E0D8] bg-white p-6 shadow-[0_16px_50px_rgba(16,17,20,0.05)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(16,17,20,0.10)]">
      <div
        className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full opacity-30 blur-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="relative">
        <p
          className="text-[11px] font-black uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </p>
        <h3 className="mt-8 text-2xl font-black tracking-[-0.05em] text-[#101114]">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#6B7280]">{copy}</p>
      </div>
    </div>
  );
}

function SchedulePreview() {
  const sessions = [
    ["Today", "Bike endurance", "1:15 · 135–155W", "#FF6A00", "Open"],
    ["Fri", "Recovery swim", "35:00 · easy", "#0E8FA0", "Planned"],
    ["Sat", "Long ride", "2:30 · fueling", "#FF6A00", "Key"],
    ["Sun", "Brick run", "25:00 · controlled", "#101114", "Adapted"],
  ];

  return (
    <div className="rounded-[2rem] border border-[#E3E0D8] bg-white p-4 shadow-[0_24px_80px_rgba(16,17,20,0.08)] md:p-5">
      <div className="flex items-center justify-between border-b border-[#E3E0D8] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563FF]">
            Training calendar
          </p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#101114]">
            Week 3 of 16
          </h3>
        </div>
        <span className="rounded-full bg-[#EAF0FF] px-3 py-1 text-xs font-black text-[#2563FF]">
          Strava ready
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {sessions.map(([day, title, meta, color, status]) => (
          <div
            key={`${day}-${title}`}
            className="flex items-center justify-between rounded-3xl border border-[#E3E0D8] bg-[#F7F6F2]/70 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-12 text-xs font-black uppercase tracking-[0.12em] text-[#9CA3AF]">
                {day}
              </span>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div>
                <p className="text-sm font-black tracking-[-0.02em] text-[#101114]">
                  {title}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#6B7280]">
                  {meta}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#6B7280]">
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Strava synced", "3", "workouts this week"],
        ["Plan adherence", "92%", "on track"],
        ["This week", "7h 20m", "planned volume"],
      ].map(([label, value, detail]) => (
        <div
          key={label}
          className="rounded-[1.5rem] border border-[#E3E0D8] bg-white p-5"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">
            {label}
          </p>
          <p className="mt-3 text-4xl font-black tracking-[-0.08em] text-[#101114]">
            {value}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#6B7280]">{detail}</p>
        </div>
      ))}
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
      if (error) console.warn("[home] getSession error", error);
      setSession(data.session ?? null);
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: SupabaseSession | null) => {
        if (!alive) return;
        setSession(nextSession ?? null);
      },
    );

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const authed = Boolean(session?.user);

  const startPlan = () => {
    if (authed) {
      router.push("/plan");
      return;
    }
    router.push(`/login?next=${encodeURIComponent("/plan")}`);
  };

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#101114]">
      <MarketingHeader
        authed={authed}
        onStart={startPlan}
        onSchedule={() => router.push("/schedule")}
      />

      <section className="relative isolate overflow-hidden px-4 pt-28 sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-16 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#2563FF]/10 blur-3xl" />
        <div className="absolute right-0 top-24 -z-10 h-[320px] w-[320px] rounded-full bg-[#C6F33C]/35 blur-3xl" />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 pb-20 lg:grid-cols-12 lg:pb-28">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D7DDFF] bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#2563FF] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#C6F33C]" /> Free AI
              triathlon plan generator
            </div>
            <h1 className="mt-6 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.08em] text-[#101114] sm:text-7xl lg:text-[5.6rem]">
              Free custom triathlon plans, {" "}
              <span className="text-[#2563FF]">instantly.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4B5563]">
              Generate a swim, bike, and run plan for your race. Connect Strava,
              track your training, adjust week by week, and get ready to crush
              race day.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CTAButton onClick={startPlan}>
                {authed ? "Open plan builder" : "Generate my free plan"}
              </CTAButton>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-bold text-[#101114] transition hover:bg-[#F7F6F2]"
              >
                See how it works
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">
              <span>Instant plan generation</span>
              <span>Track with Strava</span>
              <span>Sprint / Olympic / 70.3 / Ironman</span>
            </div>
          </div>
          <div className="lg:col-span-6">
            <HeroProductCard />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Generate your plan. Track with Strava. Adjust every week.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ValueCard
              eyebrow="01 · Generate"
              title="Get a custom plan instantly"
              copy="Choose your race, race date, experience level, weekly hours, and schedule. TrainGPT creates a swim, bike, and run plan in seconds."
              accent="#2563FF"
            />
            <ValueCard
              eyebrow="02 · Track"
              title="Connect Strava"
              copy="Sync your real workouts so completed sessions, missed training, and weekly volume live next to your generated plan."
              accent="#FF6A00"
            />
            <ValueCard
              eyebrow="03 · Adjust"
              title="Update week by week"
              copy="As training changes, your plan should change too. TrainGPT helps you see what to do next and stay pointed at race day."
              accent="#C6F33C"
            />
          </div>
        </div>
      </section>

      <section id="plan-preview" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5">
            <SectionLabel>Plan preview</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-5xl">
              Start with a plan you can actually follow.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              Most AI tools give you a wall of text. TrainGPT gives you a real
              training schedule you can save, track, and adjust as your workouts
              come in.
            </p>
          </div>
          <div className="lg:col-span-7">
            <PlanGeneratorCard authed={authed} onStart={startPlan} />
          </div>
        </div>
      </section>

      <section id="schedule" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>Training calendar</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Know exactly what to do today.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              Follow your generated plan from one simple calendar. Open today’s
              workout, track what you completed, and keep your week organized.
            </p>
          </div>
          <div className="lg:col-span-7">
            <SchedulePreview />
          </div>
        </div>
      </section>

      <section
        id="strava"
        className="border-y border-[#E3E0D8] bg-[#F7F6F2] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <SectionLabel>Strava tracking</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Your workouts sync back to the plan.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              Connect Strava so your rides, runs, and swims are tracked
              automatically. See what you completed, what you missed, and how
              your training is trending.
            </p>
          </div>
          <div className="lg:col-span-7">
            <MetricStrip />
          </div>
        </div>
      </section>

      <section id="coaching" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="rounded-[2rem] border border-[#E3E0D8] bg-[#101114] p-6 text-white shadow-[0_24px_80px_rgba(16,17,20,0.16)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
                Coach insight
              </p>
              <h3 className="mt-4 text-3xl font-black tracking-[-0.06em]">
                Good week. Keep the next one realistic.
              </h3>
              <p className="mt-4 text-base leading-7 text-white/65">
                You completed the key run and two steady rides. This week we
                keep the long ride controlled, then rebuild run volume without
                forcing intensity.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {["View adjusted week", "Ask coach", "Open Saturday"].map(
                  (item) => (
                    <div
                      key={item}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/85"
                    >
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <SectionLabel>Weekly adjustments</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Adjust your plan as training changes.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              Miss a long ride, crush a key run, or have a lighter week than
              planned. TrainGPT helps you understand what changed and what to do
              next.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#101114] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#C6F33C]">
              Start training
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.07em] md:text-6xl">
              Generate your free triathlon plan today.
            </h2>
          </div>
          <button
            type="button"
            onClick={startPlan}
            className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#101114] transition hover:bg-white/90"
          >
            {authed ? "Open plan builder" : "Generate my free plan"}
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
