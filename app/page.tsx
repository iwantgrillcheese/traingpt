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

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-2xl text-[15px] font-black tracking-[-0.08em]",
        inverse
          ? "bg-white text-[#2563FF]"
          : "bg-[#2563FF] text-white shadow-[0_12px_30px_rgba(37,99,255,0.24)]",
      )}
      aria-hidden="true"
    >
      TG
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2563FF]">
      {children}
    </p>
  );
}

function MomentumButton({
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
        "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold transition duration-200",
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
    { href: "#product-loop", label: "Product" },
    { href: "#schedule", label: "Schedule" },
    { href: "#readiness", label: "Readiness" },
    { href: "#coaching", label: "Coaching" },
  ];

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[#E3E0D8] bg-[#F7F6F2]/88 shadow-[0_12px_40px_rgba(16,17,20,0.05)] backdrop-blur-xl"
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
            onClick={authed ? onSchedule : onStart}
            className="hidden rounded-full bg-[#101114] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#25272D] sm:inline-flex"
          >
            {authed ? "Open app" : "Start free"}
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
              onClick={authed ? onSchedule : onStart}
              className="mt-2 rounded-full bg-[#2563FF] px-4 py-3 text-sm font-bold text-white"
            >
              {authed ? "Open app" : "Start free"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function ReadinessOrb() {
  return (
    <div className="relative h-32 w-32 rounded-full bg-[conic-gradient(#C6F33C_0_78%,#E9ECE8_78%_100%)] p-2 shadow-[0_18px_50px_rgba(198,243,60,0.18)]">
      <div className="grid h-full w-full place-items-center rounded-full bg-white">
        <div className="text-center">
          <div className="text-4xl font-black tracking-[-0.08em] text-[#101114]">
            78
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B7280]">
            Ready
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductPreviewCard() {
  const week = [
    {
      day: "Tue",
      sport: "Swim",
      title: "Technique",
      meta: "50m · 2,100m",
      color: "#0E8FA0",
    },
    {
      day: "Wed",
      sport: "Run",
      title: "Easy run",
      meta: "45m · Z2",
      color: "#101114",
    },
    {
      day: "Thu",
      sport: "Bike",
      title: "Endurance",
      meta: "1h 15m · 135–155W",
      color: "#FF6A00",
    },
    {
      day: "Sat",
      sport: "Bike",
      title: "Long ride",
      meta: "2h 30m · key",
      color: "#FF6A00",
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#C6F33C]/70 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#2563FF]/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-white p-5 shadow-[0_36px_90px_rgba(16,17,20,0.16)]">
        <div className="flex items-start justify-between gap-4 rounded-[1.75rem] bg-[#101114] p-5 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
              This week
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.05em]">
              Santa Cruz build
            </h3>
            <p className="mt-2 max-w-[18rem] text-sm leading-6 text-white/65">
              Your plan adjusted after last week. Long ride repeats before
              building again.
            </p>
          </div>
          <ReadinessOrb />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["7h 20m", "planned"],
            ["4 / 7", "complete"],
            ["+5", "readiness"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-3xl border border-[#E3E0D8] bg-[#F7F6F2] p-4"
            >
              <div className="text-2xl font-black tracking-[-0.06em] text-[#101114]">
                {value}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A8F98]">
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {week.map((item) => (
            <div
              key={`${item.day}-${item.title}`}
              className="flex items-center gap-3 rounded-3xl border border-[#E3E0D8] bg-white px-4 py-3"
            >
              <div className="w-10 text-xs font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
                {item.day}
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black tracking-[-0.02em] text-[#101114]">
                  {item.title}
                </div>
                <div className="mt-0.5 text-xs font-medium text-[#6B7280]">
                  {item.meta}
                </div>
              </div>
              <div className="rounded-full bg-[#EAF0FF] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#2563FF]">
                {item.sport}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#C9D6FF] bg-[#EAF0FF] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2563FF]" />
            <div>
              <p className="text-sm font-black tracking-[-0.02em] text-[#101114]">
                Coach update
              </p>
              <p className="mt-1 text-sm leading-6 text-[#46506A]">
                Volume held steady because you missed the long ride. Nail
                Saturday and next week progresses.
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
            Start with the race.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
            Generate the plan, then let the app adapt the week.
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
            Adaptive
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
            <span>First focus</span>
            <b className="text-[#101114]">Consistency</b>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-[#2563FF] px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(37,99,255,0.24)] transition hover:bg-[#184FE0]"
      >
        {authed ? "Open plan builder" : "Sign in to generate plan"}
      </button>
      <p className="mt-4 text-center text-xs font-medium text-[#6B7280]">
        Free to generate. No credit card required.
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
    ["Today", "Swim technique", "50:00 · 8×100m", "#0E8FA0", "Open session"],
    ["Wed", "Run easy", "45:00 · Z2", "#101114", "Planned"],
    ["Thu", "Bike endurance", "1:15 · 135–155W", "#FF6A00", "Key"],
    ["Sat", "Long ride", "2:30 · fueling practice", "#FF6A00", "Adapted"],
  ];

  return (
    <div className="rounded-[2rem] border border-[#E3E0D8] bg-white p-4 shadow-[0_24px_80px_rgba(16,17,20,0.08)] md:p-5">
      <div className="flex items-center justify-between border-b border-[#E3E0D8] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563FF]">
            Schedule
          </p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#101114]">
            Today is the home base
          </h3>
        </div>
        <span className="rounded-full bg-[#EAF0FF] px-3 py-1 text-xs font-black text-[#2563FF]">
          Week 3 / 16
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
        ["Race readiness", "78", "+5 this week"],
        ["Plan adherence", "92%", "On track"],
        ["This week", "7h 20m", "4 key sessions"],
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
              <span className="h-2 w-2 rounded-full bg-[#C6F33C]" /> Adaptive
              endurance coaching
            </div>
            <h1 className="mt-6 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.08em] text-[#101114] sm:text-7xl lg:text-[5.6rem]">
              Training that adapts{" "}
              <span className="text-[#2563FF]">to the week you had.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4B5563]">
              TrainGPT builds your plan around your race, schedule, and real
              training data — then adjusts every week based on what actually
              happened.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <MomentumButton onClick={startPlan}>
                {authed ? "Open plan builder" : "Start your plan"}
              </MomentumButton>
              <a
                href="#product-loop"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#E2E0D8] bg-white px-6 text-sm font-bold text-[#101114] transition hover:bg-[#F7F6F2]"
              >
                See how it works
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">
              <span>Strava connected</span>
              <span>70.3 / 140.6 / Olympic / Sprint</span>
              <span>No card to generate</span>
            </div>
          </div>
          <div className="lg:col-span-6">
            <ProductPreviewCard />
          </div>
        </div>
      </section>

      <section id="product-loop" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionLabel>The product loop</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Plan the week. Execute anywhere. Know what changed.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ValueCard
              eyebrow="01 · Build it"
              title="Generate the plan"
              copy="Start with the race, current fitness, and real availability. The plan should feel like it was written for your actual week."
              accent="#2563FF"
            />
            <ValueCard
              eyebrow="02 · Do it"
              title="Follow the session"
              copy="Every workout has a clear purpose, target, and next action. No paper schedule, no guessing, no random dashboard noise."
              accent="#FF6A00"
            />
            <ValueCard
              eyebrow="03 · Prove it"
              title="Adapt from reality"
              copy="Strava-confirmed work, missed sessions, fatigue, and consistency all feed the next coaching decision."
              accent="#C6F33C"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5">
            <SectionLabel>Start your build</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-5xl">
              Your race plan should feel alive from day one.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              Momentum gives the brand energy. The product stays calm: one clear
              plan, one clear workout, one clear coaching decision at a time.
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
            <SectionLabel>Daily execution</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Today is the hero.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              The schedule is not just a calendar. It is the daily command
              center: what to do, why it matters, and what changed after the
              last week.
            </p>
          </div>
          <div className="lg:col-span-7">
            <SchedulePreview />
          </div>
        </div>
      </section>

      <section
        id="readiness"
        className="border-y border-[#E3E0D8] bg-[#F7F6F2] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <SectionLabel>Verified fitness</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Race Readiness, not random metrics.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              Athletes should understand whether the work is building toward the
              race. Readiness rolls up consistency, load, fatigue, sport
              balance, and key session completion.
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
                Great week — your consistency is paying off.
              </h3>
              <p className="mt-4 text-base leading-7 text-white/65">
                You completed your key endurance sessions and handled the load
                well. This week we nudge the long ride up and keep the run
                controlled.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {["View adapted week", "Ask coach", "Open Saturday"].map(
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
            <SectionLabel>Coaching guidance</SectionLabel>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.07em] text-[#101114] md:text-6xl">
              Less dashboard. More decision.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#4B5563]">
              TrainGPT should tell the athlete what to do next, what changed,
              and why. Metrics support the decision — they do not lead the page.
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
              Build your next race plan in seconds.
            </h2>
          </div>
          <button
            type="button"
            onClick={startPlan}
            className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#101114] transition hover:bg-white/90"
          >
            {authed ? "Open plan builder" : "Start your plan"}
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
