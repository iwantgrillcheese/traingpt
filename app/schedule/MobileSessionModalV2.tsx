"use client";
import { track } from "@/lib/analytics/posthog-client";
import { findCompletion, completionMatches, completedEarly } from "@/utils/sessionCompletion";

import { Dialog } from "@headlessui/react";
import { format, isAfter, parseISO, startOfDay } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import ActivityStatsPanel, { getActivityHeroStats } from "./ActivityStatsPanel";
import ActivityRoute from "@/app/components/ActivityRoute";
import { supabase } from "@/lib/supabase/client";
import type { CompletedSession, Session } from "@/types/session";
import type { StravaActivity } from "@/types/strava";

type Props = {
  session: Session | null;
  stravaActivity?: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  completedSessions: CompletedSession[];
  onCompletedUpdate: (updated: CompletedSession[]) => void;
  onSessionDeleted?: (sessionId: string) => void;
  onSessionUpdated?: (updated: Session) => void;
  weekPhase?: string | null;
  raceGoal?: string | null;
};

type NotesStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function cleanTitle(title?: string | null) {
  return String(title ?? "Untitled session")
    .replace(/^\p{Extended_Pictographic}\s*/u, "")
    .replace(/^[\s—–-]+/, "")
    .replace(/^[\s:•·]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSport(value?: string | null) {
  const sport = String(value ?? "").trim().toLowerCase();
  if (!sport) return "Session";
  if (sport.includes("ride")) return "Bike";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function formatMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatMovingTime(seconds?: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatMinutes(seconds / 60);
}

function formatDistance(meters?: number | null) {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) return null;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function cleanDetails(value?: string | null) {
  return String(value ?? "")
    .replace(/\b(details\s*[—–-]\s*){2,}/gi, "")
    .replace(/\bdetails\s+details\b/gi, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}


type PaceTarget = {
  display: string;
  minSeconds: number;
  maxSeconds: number;
  unit: "/mi" | "/100m" | "/100yd";
};

type NumericTarget = {
  min: number;
  max: number;
};

function prescriptionText(session: Session) {
  return [
    session.title,
    session.intensity,
    session.details,
    session.structured_workout,
    session.purpose,
    session.coach_note,
  ].filter(Boolean).join("\n");
}

function timeToSeconds(value: string) {
  const [minutes, seconds] = value.split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function formatPaceSeconds(seconds: number, unit: PaceTarget["unit"]) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = String(rounded % 60).padStart(2, "0");
  return minutes + ":" + remainder + unit;
}

function parsePaceTarget(text: string): PaceTarget | null {
  const patterns: Array<{ regex: RegExp; unit: PaceTarget["unit"] }> = [
    { regex: /(\d{1,2}:\d{2})\s*\/\s*mi\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*\/\s*mi/i, unit: "/mi" },
    { regex: /(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*\/\s*mi/i, unit: "/mi" },
    { regex: /(\d{1,2}:\d{2})\s*\/\s*100m\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*\/\s*100m/i, unit: "/100m" },
    { regex: /(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*\/\s*100m/i, unit: "/100m" },
    { regex: /(\d{1,2}:\d{2})\s*\/\s*100yd\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*\/\s*100yd/i, unit: "/100yd" },
    { regex: /(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*\/\s*100yd/i, unit: "/100yd" },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;
    const left = timeToSeconds(match[1]);
    const right = timeToSeconds(match[2]);
    if (left == null || right == null) continue;
    return {
      display: match[1] + "–" + match[2] + pattern.unit,
      minSeconds: Math.min(left, right),
      maxSeconds: Math.max(left, right),
      unit: pattern.unit,
    };
  }
  return null;
}

function parseNumericTarget(text: string, units: string): NumericTarget | null {
  const match = text.match(new RegExp("(\\d{2,4})\\s*(?:-|–|—|to)\\s*(\\d{2,4})\\s*(?:" + units + ")", "i"));
  if (!match) return null;
  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return null;
  return { min: Math.min(left, right), max: Math.max(left, right) };
}

function inferEffortLabel(session: Session) {
  const details = cleanDetails(session.details);
  const text = [
    session.title,
    session.intensity,
    session.structured_workout,
    extractLabeledText(details, "Workout"),
  ].filter(Boolean).join(" ").toLowerCase();

  // Infer effort from the actual prescription, not rationale/coach-note language.
  // Example: "run within aerobic thresholds" is not a threshold workout.
  if (/recovery|very easy|restorative|\bz1\b/.test(text)) return "Recovery · Z1";
  if (/vo2|v02|max effort|anaerobic|\bz5\b/.test(text)) return "Hard · Z5";
  if (/threshold|cruise interval|\bz4\b/.test(text)) return "Threshold · Z3–Z4";
  if (/tempo|sweet spot|steady hard|race pace|\bz3\b/.test(text)) return "Tempo · Z3";
  if (/endurance|aerobic|easy|steady|long run|\bz2\b/.test(text)) return "Easy · Z2";
  return session.intensity?.trim() || "Controlled";
}

function heartRateGuide(session: Session, exactTarget: NumericTarget | null) {
  if (exactTarget) return exactTarget.min + "–" + exactTarget.max + " bpm";
  const effort = inferEffortLabel(session);
  if (effort.includes("Z1")) return "Z1";
  if (effort.includes("Z3–Z4")) return "Z3–Z4";
  if (effort.includes("Z3")) return "Z3";
  if (effort.includes("Z5")) return "Z4–Z5";
  return "Z2";
}

function extractLabeledText(value: string, label: "Purpose" | "Workout" | "Intensity" | "Coach note") {
  if (!value) return null;
  const match = value.match(new RegExp(label + ":\\s*(.*?)(?=\\s+(?:Purpose|Workout|Intensity|Coach note):|$)", "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function firstSentence(value?: string | null) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.split(/(?<=[.!?])\s+/)[0] || clean;
}

function actualPace(activity: StravaActivity | null | undefined, sport: string, target: PaceTarget | null) {
  const speed = activity?.average_speed;
  if (!target || typeof speed !== "number" || !Number.isFinite(speed) || speed <= 0) return null;
  const normalizedSport = sport.toLowerCase();
  let seconds: number | null = null;
  if (normalizedSport.includes("run") && target.unit === "/mi") seconds = 1609.34 / speed;
  if (normalizedSport.includes("swim") && target.unit === "/100m") seconds = 100 / speed;
  if (normalizedSport.includes("swim") && target.unit === "/100yd") seconds = 91.44 / speed;
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return {
    seconds,
    display: formatPaceSeconds(seconds, target.unit),
    matched: seconds >= target.minSeconds && seconds <= target.maxSeconds,
  };
}

function withinRange(value: number | null | undefined, range: NumericTarget | null) {
  if (!range || typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= range.min && value <= range.max;
}

function shouldShowWorkoutStructure(session: Session, details: string) {
  const sport = normalizeSport(session.sport);
  const workoutText = [
    session.structured_workout,
    extractLabeledText(details, "Workout"),
  ].filter(Boolean).join(" ").toLowerCase();

  if (sport === "Swim") return Boolean(workoutText || details);
  if (sport === "Strength") {
    return Boolean(session.structured_workout?.trim()) || /\bsets?\b|\breps?\b|\brounds?\b|\b\d+\s*[x×]\s*\d+\b/.test(workoutText);
  }

  return /\bintervals?\b|\brepeats?\b|\breps?\b|\bstrides?\b|\bwarm[ -]?up\b|\bcool[ -]?down\b|\bmain set\b|\brecovery (?:jog|spin|walk)\b|\btempo block\b|\bthreshold block\b|\bbrick\b|\b\d+\s*[x×]\s*\d+\b/.test(workoutText);
}

function PrescriptionMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-400">{label}</div>
      <div className={clsx("mt-1 truncate text-[16px] font-semibold tracking-[-0.025em]", accent ? "text-[#5B4AE8]" : "text-zinc-950")}>{value}</div>
    </div>
  );
}

function TargetTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={clsx("rounded-2xl border px-3 py-3", accent ? "border-[#D9D5FF] bg-[#F7F5FF]" : "border-zinc-200 bg-white")}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{label}</div>
      <div className={clsx("mt-1 text-[16px] font-bold tracking-[-0.025em]", accent ? "text-[#5B4AE8]" : "text-zinc-950")}>{value}</div>
    </div>
  );
}

function ComparisonRow({ label, target, actual, matched }: { label: string; target: string; actual: string; matched?: boolean | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-zinc-100 py-2.5 first:border-t-0">
      <span className="text-[13px] font-medium text-zinc-500">{label}</span>
      <span className="text-right text-[12px] font-medium text-zinc-400">{target}</span>
      <span className="flex min-w-[78px] items-center justify-end gap-1.5 text-right text-[13px] font-bold text-zinc-950">
        {actual}
        {matched === true ? <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[11px] text-white">✓</span> : null}
        {matched === false ? <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-100 text-[11px] text-amber-700">!</span> : null}
      </span>
    </div>
  );
}

function notesStatusText(status: NotesStatus) {
  if (status === "dirty") return "Unsaved";
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved";
  if (status === "error") return "Couldn’t save";
  return "Autosaves";
}

export default function MobileSessionModalV2({
  session,
  stravaActivity,
  open,
  onClose,
  completedSessions,
  onCompletedUpdate,
  onSessionDeleted,
  onSessionUpdated,
  raceGoal,
}: Props) {
  const [marking, setMarking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesStatus, setNotesStatus] = useState<NotesStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotes = useRef("");

  useEffect(() => {
    const notes = session?.athlete_notes ?? "";
    setNotesDraft(notes);
    lastSavedNotes.current = notes;
    setNotesStatus("idle");
    setErrorMessage(null);
  }, [session?.id, session?.athlete_notes]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const manualStatus = useMemo<"done" | "skipped" | null>(() => {
    const match = session ? findCompletion(completedSessions, session) : undefined;
    if (!match || match.status === "planned") return null;
    return match.status === "skipped" ? "skipped" : "done";
  }, [completedSessions, session]);

  if (!session) return null;

  const sessionDate = parseISO(session.date);
  const formattedDate = format(sessionDate, "EEE, MMM d");
  const isFutureSession = isAfter(startOfDay(sessionDate), startOfDay(new Date()));
  const title = cleanTitle(session.title);
  const sport = normalizeSport(session.sport);
  const plannedDuration = formatMinutes(session.duration ?? null);
  const completedDuration = formatMovingTime(stravaActivity?.moving_time ?? null);
  const completedDistance = formatDistance(stravaActivity?.distance ?? null);
  const isCompleted = Boolean(stravaActivity) || manualStatus === "done";
  const isSkipped = !stravaActivity && manualStatus === "skipped";
  const details = cleanDetails(session.details);
  const prescription = prescriptionText(session);
  const effortLabel = inferEffortLabel(session);
  const paceTarget = parsePaceTarget(prescription);
  const heartRateTarget = parseNumericTarget(prescription, "bpm|beats(?: per minute)?");
  const powerTarget = parseNumericTarget(prescription, "w|watts");
  const hrGuide = heartRateGuide(session, heartRateTarget);
  const workoutSummary = extractLabeledText(details, "Workout") || firstSentence(session.structured_workout) || firstSentence(details);
  const purposeSummary = session.purpose?.trim() || extractLabeledText(details, "Purpose");
  const coachNote = session.coach_note?.trim() || extractLabeledText(details, "Coach note");
  const showWorkoutStructure = shouldShowWorkoutStructure(session, details);
  const workoutStructureText = session.structured_workout?.trim() || extractLabeledText(details, "Workout") || null;
  const heroStats = getActivityHeroStats(stravaActivity, session.sport).slice(0, 4);
  const actualPaceValue = actualPace(stravaActivity, session.sport, paceTarget);
  const actualPower = stravaActivity?.weighted_average_watts ?? stravaActivity?.average_watts ?? null;
  const durationMatched = session.duration && stravaActivity?.moving_time
    ? Math.abs(stravaActivity.moving_time - session.duration * 60) <= Math.max(90, session.duration * 60 * 0.08)
    : null;
  const paceMatched = actualPaceValue?.matched ?? null;
  const heartRateMatched = withinRange(stravaActivity?.average_heartrate, heartRateTarget);
  const powerMatched = withinRange(actualPower, powerTarget);
  const comparisonChecks = [durationMatched, paceMatched, heartRateMatched, powerMatched].filter((value): value is boolean => typeof value === "boolean");
  const matchedAllComparable = comparisonChecks.length > 0 && comparisonChecks.every(Boolean);
  const missedComparable = comparisonChecks.filter((value) => !value).length;
  const executionHeadline = matchedAllComparable
    ? "Right on target."
    : missedComparable === 1
      ? "Good session — one target drifted."
      : missedComparable > 1
        ? "Solid work, but execution drifted."
        : "Workout synced.";
  const executionBody = matchedAllComparable
    ? "You stayed inside the measurable targets from the prescription."
    : missedComparable > 0
      ? "Brick matched the activity and flagged the targets that landed outside the prescription."
      : "Your Strava activity is matched to this planned workout.";
  const stravaActivityId = typeof stravaActivity?.strava_id === "number" && Number.isFinite(stravaActivity.strava_id) ? stravaActivity.strava_id : null;
  const replyReady = session.coach_response_status === "generated" && Boolean(session.coach_response);
  const showReply = Boolean(notesDraft.trim());

  const applyLocalStatus = (nextStatus: "done" | "skipped" | null) => {
    const base = completedSessions.filter((item) => !completionMatches(item, session));
    if (!nextStatus) return base;
    return [...base, { session_id: session.id, completed_at: nextStatus === "done" ? new Date().toISOString() : null, date: session.date, session_title: session.title, status: nextStatus }];
  };

  const updateStatus = async (mode: "done" | "skipped") => {


    setMarking(true);
    setErrorMessage(null);
    const previous = completedSessions;
    const shouldUndo = mode === "done" ? manualStatus === "done" : isSkipped;
    onCompletedUpdate(applyLocalStatus(shouldUndo ? null : mode));

    try {
      const { data: auth } = await supabase.auth.getUser();
      const res = await fetch(mode === "done" ? "/api/schedule/mark-done" : "/api/schedule/mark-skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id, session_date: session.date, session_title: session.title, undo: shouldUndo, clientUserId: auth.user?.id ?? null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onCompletedUpdate(previous);
        setErrorMessage(payload?.error || "Could not update session status.");
        return;
      }
      const active = mode === "done" ? payload?.completed === true : payload?.skipped === true;
      onCompletedUpdate(applyLocalStatus(active ? mode : null).map(row => completionMatches(row, session) ? { ...row, session_id: payload.session_id, completed_at: payload.completed_at } : row));
      if (active && mode === "done" && !shouldUndo && isFutureSession) track("session_completed_early", { session_id: session.id, planned_date: session.date });
    } catch (error) {
      console.error(error);
      onCompletedUpdate(previous);
      setErrorMessage("Unexpected error updating session.");
    } finally {
      setMarking(false);
    }
  };

  const saveNotes = async (nextNotes: string) => {
    if (nextNotes === lastSavedNotes.current) {
      setNotesStatus("idle");
      return;
    }
    setNotesStatus("saving");
    setErrorMessage(null);
    try {
      const cleanNotes = nextNotes.trim() || null;
      const coachPatch = cleanNotes
        ? {
            coach_response: null,
            coach_response_status: "pending",
            coach_response_generated_at: null,
            coach_response_note_snapshot: cleanNotes,
          }
        : {
            coach_response: null,
            coach_response_status: null,
            coach_response_generated_at: null,
            coach_response_note_snapshot: null,
          };
      const { error } = await supabase.from("sessions").update({ athlete_notes: cleanNotes, ...coachPatch }).eq("id", session.id);
      if (error) {
        setNotesStatus("error");
        setErrorMessage("Could not save notes.");
        return;
      }
      lastSavedNotes.current = nextNotes;
      setNotesStatus("saved");
      onSessionUpdated?.({ ...session, athlete_notes: cleanNotes, ...coachPatch });
      window.setTimeout(() => setNotesStatus("idle"), 1200);
    } catch (error) {
      console.error(error);
      setNotesStatus("error");
      setErrorMessage("Unexpected error saving notes.");
    }
  };

  const scheduleNotesSave = (nextNotes: string) => {
    setNotesDraft(nextNotes);
    setNotesStatus(nextNotes === lastSavedNotes.current ? "idle" : "dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNotes(nextNotes), 700);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this session from your calendar?");
    if (!confirmed) return;
    const { error } = await supabase.from("sessions").delete().eq("id", session.id);
    if (error) {
      setErrorMessage("Could not delete this session.");
      return;
    }
    onSessionDeleted?.(session.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50 md:hidden">
      <div className="fixed inset-0 bg-zinc-950/35 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 flex max-h-[94dvh] items-end justify-center px-2 pt-8">
        <Dialog.Panel className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-zinc-200 bg-white shadow-[0_-24px_80px_rgba(15,23,42,0.22)]">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-200" />

          <header className="border-b border-zinc-200 px-4 pb-3 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">{sport}</span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">{formattedDate}</span>
                  {stravaActivity ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Synced</span> : null}
                  {!stravaActivity && isCompleted ? <span className="rounded-full bg-[#EEF1FF] px-2.5 py-1 text-[11px] font-bold text-[#4F46E5]">{completedEarly(session, findCompletion(completedSessions, session)) ? "✓ Completed early" : "✓ Complete"}</span> : null}
                  {isSkipped ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">Skipped</span> : null}
                </div>
                <Dialog.Title className="text-[30px] font-semibold leading-[1.02] tracking-[-0.055em] text-zinc-950">{title}</Dialog.Title>
                {raceGoal ? <p className="mt-1.5 text-[13px] text-zinc-500">{raceGoal}</p> : null}
              </div>
              <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 active:scale-[0.98]">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {errorMessage ? <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] font-medium text-rose-700">{errorMessage}</div> : null}

            {!stravaActivity ? (
              <>
                <section className="grid grid-cols-2 gap-x-6 border-y border-zinc-200 py-1">
                  {plannedDuration ? <PrescriptionMetric label="Duration" value={plannedDuration} /> : null}
                  <PrescriptionMetric label="Effort" value={effortLabel} accent />
                  {paceTarget ? <PrescriptionMetric label="Target pace" value={paceTarget.display} /> : powerTarget ? <PrescriptionMetric label="Target power" value={powerTarget.min + "–" + powerTarget.max + " W"} /> : null}
                  <PrescriptionMetric label={heartRateTarget ? "Target HR" : "HR guide"} value={hrGuide} />
                </section>

                <section className="mt-4 border-l-2 border-[#7667FF] pl-3.5 pr-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6657E8]">Today’s focus</div>
                  <p className="mt-1.5 text-[15px] font-semibold leading-[1.55] text-zinc-900">{workoutSummary || "Follow the prescribed session and keep the effort controlled."}</p>
                  {purposeSummary ? <p className="mt-1.5 text-[13px] leading-5 text-zinc-500">{purposeSummary}</p> : null}
                </section>

                {showWorkoutStructure ? (
                  <details className="mt-4 overflow-hidden rounded-[18px] border border-zinc-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold text-zinc-900">
                      <span>Workout structure</span>
                      <span className="text-zinc-400">⌄</span>
                    </summary>
                    <div className="border-t border-zinc-100 px-4 py-3">
                      {workoutStructureText ? <p className="whitespace-pre-wrap text-[13px] leading-5.5 text-zinc-600">{workoutStructureText}</p> : null}
                      {coachNote && !details.toLowerCase().includes("coach note:") ? <p className="mt-3 border-t border-zinc-100 pt-3 text-[13px] leading-5 text-zinc-600"><span className="font-semibold text-zinc-900">Coach note: </span>{coachNote}</p> : null}
                    </div>
                  </details>
                ) : null}
              </>
            ) : (
              <>
                <section className="rounded-[20px] border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Coach read</div>
                  <h2 className="mt-1 text-[20px] font-bold tracking-[-0.035em] text-zinc-950">{executionHeadline}</h2>
                  <p className="mt-1 text-[13px] leading-5 text-zinc-600">{executionBody}</p>
                </section>

                {heroStats.length ? (
                  <section className="mt-3 grid grid-cols-2 gap-2">
                    {heroStats.map((stat) => <TargetTile key={stat.label} label={stat.label} value={stat.value || "—"} />)}
                  </section>
                ) : null}

                {stravaActivityId ? (
                  <section className="mt-3 rounded-[20px] border border-zinc-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Matched activity</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-zinc-900">Synced from Strava</div>
                      </div>
                      <span className="text-[11px] font-bold text-[#FC4C02]">STRAVA</span>
                    </div>
                    <ActivityRoute activityId={stravaActivityId} variant="light" compact />
                  </section>
                ) : null}

                <section className="mt-3 rounded-[20px] border border-zinc-200 bg-white px-4 py-2">
                  <div className="py-2 text-[14px] font-semibold text-zinc-950">Plan vs. actual</div>
                  {plannedDuration && completedDuration ? <ComparisonRow label="Duration" target={plannedDuration} actual={completedDuration} matched={durationMatched} /> : null}
                  {paceTarget && actualPaceValue ? <ComparisonRow label="Pace" target={paceTarget.display} actual={actualPaceValue.display} matched={paceMatched} /> : null}
                  {powerTarget && typeof actualPower === "number" ? <ComparisonRow label="Power" target={powerTarget.min + "–" + powerTarget.max + " W"} actual={Math.round(actualPower) + " W"} matched={powerMatched} /> : null}
                  {stravaActivity.average_heartrate ? <ComparisonRow label="Heart rate" target={heartRateTarget ? hrGuide : hrGuide + " guide"} actual={Math.round(stravaActivity.average_heartrate) + " bpm"} matched={heartRateMatched} /> : null}
                </section>

                <details className="mt-3 overflow-hidden rounded-[20px] border border-zinc-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[14px] font-semibold text-zinc-900">
                    <span>Detailed execution analysis</span>
                    <span className="text-zinc-400">⌄</span>
                  </summary>
                  <div className="border-t border-zinc-100 p-3">
                    <ActivityStatsPanel activity={stravaActivity} sportType={session.sport} plannedSession={session} compact />
                  </div>
                </details>

                <details className="mt-3 overflow-hidden rounded-[20px] border border-zinc-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[14px] font-semibold text-zinc-900">
                    <span>Original workout</span>
                    <span className="text-zinc-400">⌄</span>
                  </summary>
                  <div className="border-t border-zinc-100 px-4 py-3">
                    {details ? <p className="whitespace-pre-wrap text-[13px] leading-5.5 text-zinc-600">{details}</p> : <p className="text-[13px] leading-5 text-zinc-500">No detailed prescription was saved for this session.</p>}
                  </div>
                </details>
              </>
            )}

            <section className="mt-4 border-t border-zinc-200 pt-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Athlete notes</div>
                <div className={clsx("text-[11px] font-semibold", notesStatus === "error" ? "text-rose-600" : "text-zinc-400")}>{notesStatusText(notesStatus)}</div>
              </div>
              <textarea
                value={notesDraft}
                onChange={(event) => scheduleNotesSave(event.target.value)}
                onBlur={() => saveNotes(notesDraft)}
                placeholder="How did this feel? Add anything your coach should know."
                rows={3}
                className="mt-2.5 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-[14px] leading-5.5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </section>

            {showReply ? (
              <section className="mt-3 rounded-[20px] border border-[#D7DDFF] bg-[#F7FAFF] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2563FF]">Coach reply</div>
                  <div className="text-[11px] font-semibold text-[#2563FF]">{replyReady ? "Ready" : "Pending"}</div>
                </div>
                {replyReady ? <p className="mt-2 text-[14px] leading-5.5 text-zinc-800">{session.coach_response}</p> : <p className="mt-2 text-[13px] leading-5 text-zinc-600">Your coach will respond after the next training review.</p>}
              </section>
            ) : null}

            <button type="button" onClick={handleDelete} className="mx-auto mt-3 block px-4 py-2 text-[12px] font-medium text-zinc-300">Delete session</button>
          </div>

          {!stravaActivity ? (
            <footer className="grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
              <button type="button" disabled={marking} onClick={() => updateStatus("done")} className={clsx("min-h-12 rounded-2xl border px-3 text-[14px] font-semibold disabled:opacity-45", isCompleted ? "border-[#2563FF] bg-[#2563FF] text-white" : "border-[#101114] bg-[#101114] text-white")}>
                {manualStatus === "done" ? "Undo done" : "Mark done"}
              </button>
              <button type="button" disabled={marking} onClick={() => updateStatus("skipped")} className={clsx("min-h-12 rounded-2xl border px-3 text-[14px] font-semibold disabled:opacity-50", isSkipped ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-200 bg-white text-zinc-900")}>
                {isSkipped ? "Unskip" : "Skip"}
              </button>
            </footer>
          ) : null}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
