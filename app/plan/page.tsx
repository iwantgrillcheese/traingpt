"use client";

import Link from "next/link";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/posthog-client";
import { startPlanEnrichment } from "@/lib/enrichmentRunner";

export const dynamic = "force-dynamic";

type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";
type StepKey =
  | "strava"
  | "goal"
  | "experience"
  | "schedule"
  | "history"
  | "notes"
  | "review";

type FormState = {
  raceType: string;
  raceDate: string;
  experience: string;
  maxHours: string;
  restDay: DayName | "";
  preferredLongRideDay: DayName | "";
  preferredLongRunDay: DayName | "";
  unavailableDays: DayName[];
  swimComfort: string;
  twoADaysAllowed: boolean;
  athleteNotes: string;
  coachingPriorities: string[];
  bikeFTP: string;
  runPace: string;
  swimPace: string;
  paceUnit: "mi" | "km";
};

type LatestPlanParams = Partial<{
  raceType: string;
  raceDate: string;
  experience: string;
  maxHours: number | string;
  restDay: DayName;
  bikeFtp: number | string;
  runPace: string;
  swimPace: string;
  paceUnit: "mi" | "km";
  preferredLongRideDay: DayName;
  preferredLongRunDay: DayName;
  unavailableDays: DayName[];
  swimComfort: string;
  twoADaysAllowed: boolean;
  athleteNotes: string;
  coachingPriorities: string[];
}>;

type StravaRow = {
  sport_type: string | null;
  moving_time: number | null;
  start_date: string | null;
};

type StravaSummary = {
  activityCount: number;
  totalHours: number;
  runCount: number;
  bikeCount: number;
  swimCount: number;
};

const DAYS: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const RACE_TYPES = [
  "Sprint",
  "Olympic",
  "Half Ironman (70.3)",
  "Ironman (140.6)",
  "5k",
  "10k",
  "Half Marathon",
  "Marathon",
];

const EXPERIENCE_OPTIONS = [
  {
    value: "Beginner",
    title: "Newer athlete",
    desc: "I need a conservative build and clear structure.",
  },
  {
    value: "Intermediate",
    title: "Consistent trainer",
    desc: "I train regularly and want a realistic race build.",
  },
  {
    value: "Advanced",
    title: "Experienced racer",
    desc: "I can handle more specificity and bigger weeks.",
  },
];

const SWIM_OPTIONS = [
  {
    value: "new",
    title: "New to swimming",
    desc: "More technique and confidence early.",
  },
  {
    value: "developing",
    title: "Developing",
    desc: "I can swim, but it is a limiter.",
  },
  {
    value: "comfortable",
    title: "Comfortable",
    desc: "Swim training can progress normally.",
  },
  { value: "strong", title: "Strong swimmer", desc: "Swim is not a limiter." },
];

const PRIORITIES = [
  "Swim technique",
  "Run durability",
  "Bike strength",
  "Race pace confidence",
  "Injury prevention",
  "Consistency",
];

const STEPS: Array<{ key: StepKey; title: string; eyebrow: string }> = [
  { key: "strava", title: "Training data", eyebrow: "Step 1" },
  { key: "goal", title: "Race goal", eyebrow: "Step 2" },
  { key: "experience", title: "Current fitness", eyebrow: "Step 3" },
  { key: "schedule", title: "Training week", eyebrow: "Step 4" },
  { key: "history", title: "Training history", eyebrow: "Step 5" },
  { key: "notes", title: "Coach notes", eyebrow: "Step 6" },
  { key: "review", title: "Review", eyebrow: "Step 7" },
];

const INITIAL_FORM: FormState = {
  raceType: "",
  raceDate: "",
  experience: "",
  maxHours: "",
  restDay: "Monday",
  preferredLongRideDay: "Saturday",
  preferredLongRunDay: "Sunday",
  unavailableDays: [],
  swimComfort: "",
  twoADaysAllowed: false,
  athleteNotes: "",
  coachingPriorities: [],
  bikeFTP: "",
  runPace: "",
  swimPace: "",
  paceUnit: "mi",
};

const PLAN_DRAFT_KEY = "traingpt:plan-builder-draft:v1";

function isRunningRace(raceType: string) {
  return ["5k", "10k", "Half Marathon", "Marathon"].includes(raceType);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatHours(value: number | null | undefined) {
  if (!Number.isFinite(value ?? Number.NaN)) return "—";
  return `${Number(value).toFixed(1)}h`;
}

function isDayName(value: unknown): value is DayName {
  return typeof value === "string" && DAYS.includes(value as DayName);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function sanitizeFormDraft(value: unknown): FormState | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<FormState>;

  return {
    raceType: typeof source.raceType === "string" ? source.raceType : "",
    raceDate: typeof source.raceDate === "string" ? source.raceDate : "",
    experience: typeof source.experience === "string" ? source.experience : "",
    maxHours: typeof source.maxHours === "string" ? source.maxHours : "",
    restDay: isDayName(source.restDay) ? source.restDay : "Monday",
    preferredLongRideDay: isDayName(source.preferredLongRideDay)
      ? source.preferredLongRideDay
      : "Saturday",
    preferredLongRunDay: isDayName(source.preferredLongRunDay)
      ? source.preferredLongRunDay
      : "Sunday",
    unavailableDays: normalizeStringArray(source.unavailableDays).filter(
      isDayName,
    ),
    swimComfort:
      typeof source.swimComfort === "string" ? source.swimComfort : "",
    twoADaysAllowed:
      typeof source.twoADaysAllowed === "boolean"
        ? source.twoADaysAllowed
        : false,
    athleteNotes:
      typeof source.athleteNotes === "string" ? source.athleteNotes : "",
    coachingPriorities: normalizeStringArray(source.coachingPriorities),
    bikeFTP: typeof source.bikeFTP === "string" ? source.bikeFTP : "",
    runPace: typeof source.runPace === "string" ? source.runPace : "",
    swimPace: typeof source.swimPace === "string" ? source.swimPace : "",
    paceUnit: source.paceUnit === "km" ? "km" : "mi",
  };
}

function summarizeStravaRows(rows: StravaRow[]): StravaSummary | null {
  if (!rows.length) return null;

  const sportCount = (sport: string) =>
    rows.filter((row) => String(row.sport_type ?? "").toLowerCase() === sport)
      .length;

  return {
    activityCount: rows.length,
    totalHours: rows.reduce(
      (acc, row) => acc + (row.moving_time ?? 0) / 3600,
      0,
    ),
    runCount: sportCount("run"),
    bikeCount: sportCount("bike"),
    swimCount: sportCount("swim"),
  };
}

function OptionCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-2xl border px-4 py-4 text-left transition",
        active
          ? "border-[#2563FF] bg-[#2563FF] text-white shadow-sm"
          : "border-[#E3E0D8] bg-white text-[#101114] hover:border-zinc-300 hover:bg-[#F7F6F2]",
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      {desc ? (
        <div
          className={cx(
            "mt-1 text-sm leading-5",
            active ? "text-white/70" : "text-[#6B7280]",
          )}
        >
          {desc}
        </div>
      ) : null}
    </button>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-base text-[#101114] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]",
        props.className,
      )}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-base text-[#101114] outline-none transition focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]",
        props.className,
      )}
    />
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#101114]">{label}</label>
      {hint ? (
        <p className="mt-1 text-sm leading-5 text-[#6B7280]">{hint}</p>
      ) : null}
    </div>
  );
}

function DayToggle({
  day,
  active,
  onClick,
}: {
  day: DayName;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-[#2563FF] bg-[#2563FF] text-white"
          : "border-[#E3E0D8] bg-white text-zinc-700 hover:bg-[#F7F6F2]",
      )}
    >
      {day.slice(0, 3)}
    </button>
  );
}

function PlanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoredDraftRef = useRef(false);
  const syncStartedRef = useRef(false);

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [stravaSummary, setStravaSummary] = useState<StravaSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusLine, setStatusLine] = useState("");

  const currentStep = STEPS[activeStep];
  const isRunPlan = isRunningRace(form.raceType);

  const stravaConnectHref = useMemo(() => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    if (!clientId || typeof window === "undefined") return "/settings";

    const callback = `${window.location.origin}/api/strava/callback`;
    const returnTo = "/plan?source=strava&step=strava";

    return `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      callback,
    )}&scope=activity:read_all,profile:read_all&approval_prompt=auto&state=${encodeURIComponent(returnTo)}`;
  }, []);

  const savePlanDraft = useCallback(() => {
    try {
      sessionStorage.setItem(
        PLAN_DRAFT_KEY,
        JSON.stringify({ form, activeStep, savedAt: Date.now() }),
      );
    } catch (err) {
      console.warn("[plan] failed to save plan draft before Strava OAuth", err);
    }
  }, [activeStep, form]);

  const loadStravaRows = useCallback(async (userId: string) => {
    const sinceISO = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error: stravaError } = await supabase
      .from("strava_activities")
      .select("sport_type,moving_time,start_date")
      .eq("user_id", userId)
      .gte("start_date", sinceISO)
      .order("start_date", { ascending: false })
      .limit(250);

    if (stravaError) {
      console.error("[plan] Strava activity lookup failed", stravaError);
      return [] as StravaRow[];
    }

    return (Array.isArray(data) ? data : []) as StravaRow[];
  }, []);

  const refreshStravaSummary = useCallback(
    async (userId: string) => {
      const rows = await loadStravaRows(userId);
      setStravaSummary(summarizeStravaRows(rows));
    },
    [loadStravaRows],
  );

  useEffect(() => {
    const source = searchParams?.get("source");
    const step = searchParams?.get("step");
    const callbackError = searchParams?.get("error");

    if (callbackError) {
      setError(
        callbackError === "no_user_session"
          ? "Your session was not available after connecting Strava. Please refresh and try again."
          : "Strava connection did not complete. Please try again.",
      );
    }

    if (source !== "strava") return;

    try {
      const raw = sessionStorage.getItem(PLAN_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          form?: unknown;
          activeStep?: unknown;
          savedAt?: unknown;
        };
        const draft = sanitizeFormDraft(parsed.form);
        const savedAt = Number(parsed.savedAt ?? 0);
        const isFresh =
          Number.isFinite(savedAt) && Date.now() - savedAt < 60 * 60 * 1000;

        if (draft && isFresh) {
          setForm(draft);
          setActiveStep(
            Number.isInteger(parsed.activeStep)
              ? Math.min(
                  Math.max(Number(parsed.activeStep), 0),
                  STEPS.length - 1,
                )
              : 0,
          );
          restoredDraftRef.current = true;
        }

        sessionStorage.removeItem(PLAN_DRAFT_KEY);
      }
    } catch (err) {
      console.warn("[plan] failed to restore Strava OAuth draft", err);
    }

    if (step === "strava") setActiveStep(0);
  }, [searchParams]);

  useEffect(() => {
    const prefillFromSearch = () => {
      const next: Partial<FormState> = {};
      const raceType = searchParams?.get("raceType")?.trim();
      const raceDate = searchParams?.get("raceDate")?.trim();
      if (raceType) next.raceType = raceType;
      if (raceDate && /^\d{4}-\d{2}-\d{2}$/.test(raceDate))
        next.raceDate = raceDate;
      if (Object.keys(next).length) setForm((prev) => ({ ...prev, ...next }));
    };

    prefillFromSearch();
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent("/plan")}`);
        setSessionChecked(true);
        return;
      }

      const [planRes, profileRes] = await Promise.all([
        supabase
          .from("plans")
          .select("race_type, race_date, plan")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("strava_access_token")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);

      if (planRes.data && !restoredDraftRef.current) {
        setHasPlan(true);
        const params = ((planRes.data as any).plan?.params ??
          {}) as LatestPlanParams;
        setForm((prev) => ({
          ...prev,
          raceType:
            (planRes.data as any).race_type ?? params.raceType ?? prev.raceType,
          raceDate:
            (planRes.data as any).race_date ?? params.raceDate ?? prev.raceDate,
          experience: params.experience ?? prev.experience,
          maxHours:
            params.maxHours != null ? String(params.maxHours) : prev.maxHours,
          restDay: params.restDay ?? prev.restDay,
          bikeFTP:
            params.bikeFtp != null ? String(params.bikeFtp) : prev.bikeFTP,
          runPace: params.runPace ?? prev.runPace,
          swimPace: params.swimPace ?? prev.swimPace,
          paceUnit: params.paceUnit ?? prev.paceUnit,
          preferredLongRideDay:
            params.preferredLongRideDay ?? prev.preferredLongRideDay,
          preferredLongRunDay:
            params.preferredLongRunDay ?? prev.preferredLongRunDay,
          unavailableDays: Array.isArray(params.unavailableDays)
            ? params.unavailableDays
            : prev.unavailableDays,
          swimComfort: params.swimComfort ?? prev.swimComfort,
          twoADaysAllowed:
            typeof params.twoADaysAllowed === "boolean"
              ? params.twoADaysAllowed
              : prev.twoADaysAllowed,
          athleteNotes: params.athleteNotes ?? prev.athleteNotes,
          coachingPriorities: Array.isArray(params.coachingPriorities)
            ? params.coachingPriorities
            : prev.coachingPriorities,
        }));
      } else if (planRes.data) {
        setHasPlan(true);
      }

      const hasStravaToken = Boolean(
        (profileRes.data as any)?.strava_access_token,
      );
      setStravaConnected(hasStravaToken);

      await refreshStravaSummary(session.user.id);
      setSessionChecked(true);

      if (
        hasStravaToken &&
        searchParams?.get("sync") === "needed" &&
        !syncStartedRef.current
      ) {
        syncStartedRef.current = true;
        setStravaSyncing(true);

        fetch("/api/strava_sync", { method: "POST" })
          .then(async (res) => {
            if (!res.ok) throw new Error(await res.text());
            await refreshStravaSummary(session.user.id);
          })
          .catch((err) => {
            console.warn("[plan] background Strava sync failed", err);
          })
          .finally(() => {
            setStravaSyncing(false);
          });
      }
    };

    load().catch((err) => {
      console.error("[plan] load failed", err);
      setError("We could not load your plan settings. Refresh and try again.");
      setSessionChecked(true);
    });
  }, [refreshStravaSummary, router, searchParams]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleUnavailableDay = (day: DayName) => {
    setForm((prev) => ({
      ...prev,
      unavailableDays: prev.unavailableDays.includes(day)
        ? prev.unavailableDays.filter((item) => item !== day)
        : [...prev.unavailableDays, day],
    }));
  };

  const togglePriority = (priority: string) => {
    setForm((prev) => ({
      ...prev,
      coachingPriorities: prev.coachingPriorities.includes(priority)
        ? prev.coachingPriorities.filter((item) => item !== priority)
        : [...prev.coachingPriorities, priority],
    }));
  };

  const canContinue = useMemo(() => {
    if (currentStep.key === "strava") return true;
    if (currentStep.key === "goal")
      return Boolean(form.raceType && form.raceDate);
    if (currentStep.key === "experience")
      return Boolean(form.experience && form.maxHours);
    if (currentStep.key === "schedule") return Boolean(form.restDay);
    if (currentStep.key === "history")
      return isRunPlan || Boolean(form.swimComfort);
    return true;
  }, [currentStep.key, form, isRunPlan]);

  const nextStep = () => {
    if (!canContinue) return;
    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const prevStep = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  const submitPlan = async () => {
    setError("");
    setLoading(true);
    setStatusLine(
      "Building your plan around your race, schedule, and constraints…",
    );

    const startedAt = Date.now();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent("/plan")}`);
        return;
      }

      const raceType = form.raceType;
      const planType = isRunningRace(raceType) ? "running" : "triathlon";

      const preferencesText = [
        form.preferredLongRideDay
          ? `Preferred long ride day: ${form.preferredLongRideDay}`
          : "",
        form.preferredLongRunDay
          ? `Preferred long run day: ${form.preferredLongRunDay}`
          : "",
        form.unavailableDays.length
          ? `Unavailable days: ${form.unavailableDays.join(", ")}`
          : "",
        form.twoADaysAllowed
          ? "Two-a-days are allowed when needed."
          : "Avoid two-a-days unless necessary.",
        form.swimComfort ? `Swim comfort: ${form.swimComfort}` : "",
        form.coachingPriorities.length
          ? `Training priorities: ${form.coachingPriorities.join(", ")}`
          : "",
        form.athleteNotes.trim()
          ? `Athlete notes: ${form.athleteNotes.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/finalize-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceType,
          raceDate: form.raceDate,
          experience: form.experience,
          maxHours: Number(form.maxHours),
          restDay: form.restDay || "Monday",
          bikeFTP: form.bikeFTP || undefined,
          runPace: form.runPace || undefined,
          swimPace: form.swimPace || undefined,
          paceUnit: form.paceUnit,
          planType,
          preferencesText,
          preferredLongRideDay: form.preferredLongRideDay || undefined,
          preferredLongRunDay: form.preferredLongRunDay || undefined,
          unavailableDays: form.unavailableDays,
          swimComfort: form.swimComfort || undefined,
          twoADaysAllowed: form.twoADaysAllowed,
          athleteNotes: form.athleteNotes.trim() || undefined,
          coachingPriorities: form.coachingPriorities,
          clientUserId: session.user.id,
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) {
        const backendMessage =
          typeof json?.error === "string"
            ? json.error
            : typeof json?.message === "string"
              ? json.message
              : typeof text === "string" &&
                  text.trim() &&
                  !text.trim().startsWith("{")
                ? text.trim()
                : "We could not generate your plan. Please try again.";

        throw new Error(backendMessage);
      }

      track("plan_generation_completed", {
        race_type: form.raceType,
        race_date: form.raceDate,
        experience: form.experience,
        max_hours: form.maxHours,
        generation_time_ms: Date.now() - startedAt,
      });

      if (json?.enrichmentPending && typeof json?.planId === "string") {
        // Fire-and-forget: the plan is fully usable now (scaffold details are
        // complete); the coach detailing pass continues across the redirect.
        void startPlanEnrichment({
          planId: json.planId,
          totalWeeks: Number(json?.totalWeeks ?? 0),
        });
      }

      const planIdParam =
        typeof json?.planId === "string"
          ? `&planId=${encodeURIComponent(json.planId)}`
          : "";
      router.replace(`/schedule?walkthrough=1${planIdParam}`);
      router.refresh();
    } catch (err: any) {
      console.error("[plan] generation failed", err);
      track("plan_generation_failed", {
        error_type: String(err?.message ?? "unknown").slice(0, 120),
        generation_time_ms: Date.now() - startedAt,
      });
      const message =
        err instanceof Error &&
        typeof err.message === "string" &&
        err.message.trim()
          ? err.message
          : typeof err === "string"
            ? err
            : "Something went wrong while generating your plan. Please try again.";

      setError(
        message === "[object Object]"
          ? "We could not generate your plan. Please try again."
          : message,
      );
      setLoading(false);
    }
  };

  const reviewRows = [
    [
      "Strava",
      stravaConnected
        ? `Connected${stravaSummary ? ` · ${stravaSummary.activityCount} activities` : ""}`
        : "Not connected",
    ],
    ["Race", form.raceType || "Not selected"],
    ["Race date", form.raceDate || "Not selected"],
    ["Experience", form.experience || "Not selected"],
    ["Weekly time", form.maxHours ? `${form.maxHours} hours` : "Not selected"],
    ["Rest day", form.restDay || "Not selected"],
    [
      "Long ride",
      isRunPlan ? "Not applicable" : form.preferredLongRideDay || "Default",
    ],
    ["Long run", form.preferredLongRunDay || "Default"],
    [
      "Unavailable",
      form.unavailableDays.length ? form.unavailableDays.join(", ") : "None",
    ],
    [
      "Swim comfort",
      isRunPlan ? "Not applicable" : form.swimComfort || "Not selected",
    ],
    [
      "Priorities",
      form.coachingPriorities.length
        ? form.coachingPriorities.join(", ")
        : "None",
    ],
  ];

  if (!sessionChecked) {
    return (
      <main className="min-h-[100dvh] bg-[#F7F6F2] px-6 py-12 text-[#4B5563]">
        <div className="mx-auto max-w-3xl">Loading plan builder…</div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#F7F6F2] text-[#101114]">
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-6 backdrop-blur">
          <div className="w-full max-w-md rounded-[2rem] border border-[#E3E0D8] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[#E3E0D8] border-t-zinc-950" />
            <h2 className="text-xl font-semibold tracking-tight">
              Generating your plan
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              {statusLine}
            </p>
            <p className="mt-4 text-xs text-[#9CA3AF]">
              Longer race plans can take a couple minutes. Keep this tab open.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-[#E3E0D8] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2563FF]">
              Plan builder
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.07em] sm:text-5xl">
              {hasPlan
                ? "Rebuild your training plan."
                : "Build your training plan."}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#4B5563]">
              A premium guided flow for your race, availability, training
              background, and the week you can actually live with.
            </p>
          </div>

          {hasPlan ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#D7DDFF] bg-[#EFF3FF] p-4 sm:max-w-xl">
              <p className="text-sm leading-6 text-[#1E3A8A]">
                <span className="font-bold">You already have an active plan.</span>{" "}
                Looking for this week’s training? It’s on your schedule —
                rebuilding here replaces your current plan and its adaptation
                history.
              </p>
              <Link
                href="/schedule"
                className="inline-flex w-fit items-center justify-center rounded-full bg-[#2563FF] px-4 py-2 text-[13px] font-black text-white"
              >
                Go to my schedule
              </Link>
            </div>
          ) : null}
          {stravaConnected ? (
            <div className="rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-sm text-[#4B5563]">
              <span className="font-medium text-[#101114]">
                Strava connected
              </span>
              {stravaSyncing
                ? " · syncing activities…"
                : stravaSummary
                  ? ` · ${stravaSummary.activityCount} recent activities · ${formatHours(stravaSummary.totalHours)}`
                  : ""}
            </div>
          ) : null}
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-2">
              {STEPS.map((step, index) => {
                const active = index === activeStep;
                const complete = index < activeStep;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition",
                      active
                        ? "bg-[#EAF0FF] text-[#2563FF]"
                        : "text-[#4B5563] hover:bg-white hover:text-[#101114]",
                    )}
                  >
                    <span
                      className={cx(
                        "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                        active
                          ? "border-white bg-white text-[#2563FF]"
                          : complete
                            ? "border-[#2563FF] bg-[#2563FF] text-white"
                            : "border-[#E3E0D8] bg-white text-[#6B7280]",
                      )}
                    >
                      {complete ? "✓" : index + 1}
                    </span>
                    <span>
                      <span className="block text-xs opacity-60">
                        {step.eyebrow}
                      </span>
                      <span className="block font-medium">{step.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-[#E3E0D8] bg-white p-5 shadow-[0_24px_80px_rgba(16,17,20,0.07)] sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                  {currentStep.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {currentStep.title}
                </h2>
              </div>
              <div className="text-sm text-[#9CA3AF]">
                {activeStep + 1} / {STEPS.length}
              </div>
            </div>

            {error ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {currentStep.key === "strava" ? (
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-[#E3E0D8] bg-[#F7F6F2] p-6 sm:p-8">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Optional
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#101114]">
                    Start from your real training history.
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4B5563]">
                    Connect Strava and TrainGPT can use your recent volume,
                    sport balance, and available pace/power data to calibrate
                    the plan. You can skip this and enter details manually.
                  </p>

                  {stravaConnected ? (
                    <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                      <div className="font-semibold">Strava connected</div>
                      <div className="mt-1 text-emerald-800">
                        {stravaSyncing
                          ? "We’re syncing your latest activities in the background. You can keep going."
                          : stravaSummary
                            ? `${stravaSummary.activityCount} activities found · ${formatHours(stravaSummary.totalHours)} total · Run/Bike/Swim ${stravaSummary.runCount}/${stravaSummary.bikeCount}/${stravaSummary.swimCount}`
                            : "Connected. You can continue while activities sync."}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <a
                        href={stravaConnectHref}
                        onClick={() => {
                          savePlanDraft();
                          track("strava_connect_clicked", {
                            source: "plan_builder_step_1",
                          });
                        }}
                        className="inline-flex justify-center rounded-full bg-[#2563FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#184FE0]"
                      >
                        Connect Strava
                      </a>
                      <button
                        type="button"
                        onClick={nextStep}
                        className="rounded-full border border-[#E3E0D8] bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-[#F7F6F2]"
                      >
                        Skip for now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {currentStep.key === "goal" ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {RACE_TYPES.map((race) => (
                    <OptionCard
                      key={race}
                      active={form.raceType === race}
                      title={race}
                      onClick={() => setField("raceType", race)}
                    />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-center">
                  <FieldLabel
                    label="Race date"
                    hint="Your plan will build backward from this date."
                  />
                  <TextInput
                    type="date"
                    value={form.raceDate}
                    onChange={(e) => setField("raceDate", e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {currentStep.key === "experience" ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  {EXPERIENCE_OPTIONS.map((option) => (
                    <OptionCard
                      key={option.value}
                      active={form.experience === option.value}
                      title={option.title}
                      desc={option.desc}
                      onClick={() => setField("experience", option.value)}
                    />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-center">
                  <FieldLabel
                    label="Weekly training time"
                    hint="Use a realistic typical week, not your absolute best week."
                  />
                  <TextInput
                    type="number"
                    min="1"
                    max="30"
                    inputMode="numeric"
                    placeholder="8"
                    value={form.maxHours}
                    onChange={(e) => setField("maxHours", e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {currentStep.key === "schedule" ? (
              <div className="space-y-7">
                <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-center">
                  <FieldLabel
                    label="Preferred rest day"
                    hint="We’ll avoid scheduling training here where possible."
                  />
                  <SelectInput
                    value={form.restDay}
                    onChange={(e) =>
                      setField("restDay", e.target.value as DayName)
                    }
                  >
                    {DAYS.map((day) => (
                      <option key={day}>{day}</option>
                    ))}
                  </SelectInput>
                </div>

                {!isRunPlan ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel
                        label="Long ride day"
                        hint="Useful for shift work or non-standard weekends."
                      />
                      <SelectInput
                        className="mt-3"
                        value={form.preferredLongRideDay}
                        onChange={(e) =>
                          setField(
                            "preferredLongRideDay",
                            e.target.value as DayName,
                          )
                        }
                      >
                        <option value="">Use default</option>
                        {DAYS.map((day) => (
                          <option key={day}>{day}</option>
                        ))}
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel
                        label="Long run day"
                        hint="We’ll separate long sessions when possible."
                      />
                      <SelectInput
                        className="mt-3"
                        value={form.preferredLongRunDay}
                        onChange={(e) =>
                          setField(
                            "preferredLongRunDay",
                            e.target.value as DayName,
                          )
                        }
                      >
                        <option value="">Use default</option>
                        {DAYS.map((day) => (
                          <option key={day}>{day}</option>
                        ))}
                      </SelectInput>
                    </div>
                  </div>
                ) : (
                  <div>
                    <FieldLabel
                      label="Long run day"
                      hint="Pick the day that usually works best for longer runs."
                    />
                    <SelectInput
                      className="mt-3 max-w-xs"
                      value={form.preferredLongRunDay}
                      onChange={(e) =>
                        setField(
                          "preferredLongRunDay",
                          e.target.value as DayName,
                        )
                      }
                    >
                      <option value="">Use default</option>
                      {DAYS.map((day) => (
                        <option key={day}>{day}</option>
                      ))}
                    </SelectInput>
                  </div>
                )}

                <div>
                  <FieldLabel
                    label="Days you usually can’t train"
                    hint="Optional. We’ll treat these as hard constraints where possible."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <DayToggle
                        key={day}
                        day={day}
                        active={form.unavailableDays.includes(day)}
                        onClick={() => toggleUnavailableDay(day)}
                      />
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-[#E3E0D8] bg-[#F7F6F2] px-4 py-4">
                  <input
                    type="checkbox"
                    checked={form.twoADaysAllowed}
                    onChange={(e) =>
                      setField("twoADaysAllowed", e.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-zinc-300"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[#101114]">
                      Two-a-days are okay when needed
                    </span>
                    <span className="mt-1 block text-sm text-[#6B7280]">
                      Useful for busy athletes, but we’ll avoid stacking hard
                      sessions.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {currentStep.key === "history" ? (
              <div className="space-y-7">
                {!isRunPlan ? (
                  <div>
                    <FieldLabel
                      label="How comfortable are you in the swim?"
                      hint="This helps early weeks emphasize technique or normal progression."
                    />
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {SWIM_OPTIONS.map((option) => (
                        <OptionCard
                          key={option.value}
                          active={form.swimComfort === option.value}
                          title={option.title}
                          desc={option.desc}
                          onClick={() => setField("swimComfort", option.value)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-[#E3E0D8] bg-[#F7F6F2] p-5">
                  <h3 className="text-sm font-semibold text-[#101114]">
                    Optional performance metrics
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                    Manual values override Strava estimates. Leave these blank
                    if you want TrainGPT to infer what it can from recent
                    activity data.
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel label="Bike FTP" hint="Optional" />
                      <TextInput
                        className="mt-3"
                        type="number"
                        placeholder="240"
                        value={form.bikeFTP}
                        onChange={(e) => setField("bikeFTP", e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel label="Run threshold pace" hint="Optional" />
                      <TextInput
                        className="mt-3"
                        placeholder={
                          form.paceUnit === "km" ? "4:40 / km" : "7:30 / mi"
                        }
                        value={form.runPace}
                        onChange={(e) => setField("runPace", e.target.value)}
                      />
                    </div>
                    {!isRunPlan ? (
                      <div>
                        <FieldLabel
                          label="Swim threshold pace"
                          hint="Optional"
                        />
                        <TextInput
                          className="mt-3"
                          placeholder="1:40 / 100m"
                          value={form.swimPace}
                          onChange={(e) => setField("swimPace", e.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep.key === "notes" ? (
              <div className="space-y-7">
                <div>
                  <FieldLabel
                    label="What should your plan know?"
                    hint="Tell us about work schedule, weak disciplines, injury history, travel, or preferences."
                  />
                  <textarea
                    value={form.athleteNotes}
                    onChange={(e) => setField("athleteNotes", e.target.value)}
                    rows={7}
                    placeholder="Examples: I work shifts and need long rides on Wednesdays. I’m new at swimming and want technique early. I hate running two days in a row."
                    className="mt-3 w-full rounded-3xl border border-[#E3E0D8] bg-white px-4 py-4 text-base text-[#101114] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563FF] focus:ring-4 focus:ring-[#EAF0FF]"
                  />
                </div>
                <div>
                  <FieldLabel
                    label="Training priorities"
                    hint="Optional. Pick the things you want the plan to emphasize."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PRIORITIES.map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => togglePriority(priority)}
                        className={cx(
                          "rounded-full border px-4 py-2 text-sm font-medium transition",
                          form.coachingPriorities.includes(priority)
                            ? "border-[#2563FF] bg-[#2563FF] text-white"
                            : "border-[#E3E0D8] bg-white text-zinc-700 hover:bg-[#F7F6F2]",
                        )}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep.key === "review" ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#E3E0D8] bg-[#F7F6F2] p-5">
                  <h3 className="text-sm font-semibold text-[#101114]">
                    Your plan will be built around
                  </h3>
                  <div className="mt-4 divide-y divide-zinc-200">
                    {reviewRows.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <span className="text-[#6B7280]">{label}</span>
                        <span className="text-right font-medium text-[#101114]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {form.athleteNotes.trim() ? (
                  <div className="rounded-3xl border border-[#E3E0D8] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#101114]">
                      Coach notes
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#4B5563]">
                      {form.athleteNotes.trim()}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-[#E3E0D8] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={prevStep}
                disabled={activeStep === 0}
                className="rounded-full border border-[#E3E0D8] bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-[#F7F6F2] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {currentStep.key === "review" ? (
                <button
                  type="button"
                  onClick={submitPlan}
                  className="rounded-full bg-[#2563FF] px-6 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(37,99,255,0.24)] transition hover:bg-[#184FE0]"
                >
                  {hasPlan ? "Re-generate plan" : "Generate plan"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canContinue}
                  className="rounded-full bg-[#2563FF] px-6 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(37,99,255,0.24)] transition hover:bg-[#184FE0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {currentStep.key === "strava" ? "Continue" : "Continue"}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#F7F6F2]" />}>
      <PlanPageContent />
    </Suspense>
  );
}
