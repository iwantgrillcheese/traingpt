"use client";

import { Dialog } from "@headlessui/react";
import { format, isAfter, parseISO, startOfDay } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import ActivityStatsPanel from "./ActivityStatsPanel";
import { track } from "@/lib/analytics/posthog-client";
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
  weekLabel?: string;
  weekPhase?: string | null;
  recentCompleted?: number;
  recentMissed?: number;
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

function statusText(status: NotesStatus) {
  if (status === "dirty") return "Unsaved changes";
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved";
  if (status === "error") return "Couldn’t save";
  return "Autosaves";
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

export default function SessionModal({
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

  useEffect(() => {
    if (!open || !session?.id) return;
    track("session_opened", { sport: session.sport || "unknown", date: session.date || null, is_planned: true });
  }, [open, session?.id, session?.sport, session?.date]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const manualStatus = useMemo<"done" | "skipped" | null>(() => {
    const match = completedSessions.find((item) => item.date === session?.date && item.session_title === session?.title);
    if (!match) return null;
    return match.status === "skipped" ? "skipped" : "done";
  }, [completedSessions, session?.date, session?.title]);

  if (!session) return null;

  const sessionDate = parseISO(session.date);
  const formattedDate = format(sessionDate, "EEE, MMM d, yyyy");
  const isFutureSession = isAfter(startOfDay(sessionDate), startOfDay(new Date()));
  const plannedDuration = formatMinutes(session.duration ?? null);
  const completedDuration = formatMovingTime(stravaActivity?.moving_time ?? null);
  const completedDistance = formatDistance(stravaActivity?.distance ?? null);
  const title = cleanTitle(session.title);
  const sport = normalizeSport(session.sport);
  const details = cleanDetails(session.details);
  const isCompleted = Boolean(stravaActivity) || manualStatus === "done";
  const isSkipped = !stravaActivity && manualStatus === "skipped";

  const applyLocalStatus = (nextStatus: "done" | "skipped" | null) => {
    const base = completedSessions.filter((item) => item.date !== session.date || item.session_title !== session.title);
    if (!nextStatus) return base;
    return [...base, { date: session.date, session_title: session.title, status: nextStatus }];
  };

  const updateStatus = async (mode: "done" | "skipped") => {
    if (mode === "done" && isFutureSession) {
      setErrorMessage("Future workouts cannot be marked complete yet. Move the session or wait until the workout day.");
      return;
    }

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
        body: JSON.stringify({ session_date: session.date, session_title: session.title, undo: shouldUndo, clientUserId: auth.user?.id ?? null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onCompletedUpdate(previous);
        setErrorMessage(payload?.error || "Could not update session status.");
        return;
      }
      const active = mode === "done" ? payload?.completed === true : payload?.skipped === true;
      onCompletedUpdate(applyLocalStatus(active ? mode : null));
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

  const coachReplyVisible = Boolean(notesDraft.trim());
  const coachReplyReady = session.coach_response_status === "generated" && Boolean(session.coach_response);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-[#101114]/30 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel className="flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border border-[#E3E0D8] bg-white shadow-[0_30px_100px_rgba(16,17,20,0.24)]">
          <div className="border-b border-[#E3E0D8] bg-[#F7F6F2] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-600">{sport}</span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-600">{formattedDate}</span>
                  {isCompleted ? <span className="rounded-full border border-[#BBD1FF] bg-[#EAF0FF] px-2.5 py-1 text-[12px] font-black text-[#2563FF]">Complete</span> : null}
                  {isSkipped ? <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-600">Skipped</span> : null}
                </div>
                <Dialog.Title className="text-[32px] font-black leading-[0.96] tracking-[-0.07em] text-[#101114]">{title}</Dialog.Title>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-[#6B7280]">
                  {plannedDuration ? <span>Planned {plannedDuration}</span> : null}
                  {completedDuration ? <span>Completed {completedDuration}</span> : null}
                  {completedDistance ? <span>{completedDistance}</span> : null}
                  {raceGoal ? <span>{raceGoal}</span> : null}
                </div>
              </div>
              <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#E3E0D8] bg-white text-[#6B7280] hover:border-[#CFCBC1] hover:bg-white">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-5">
            {errorMessage ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{errorMessage}</div> : null}

            <section>
              {details ? (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-800">{details}</p>
              ) : (
                <p className="text-[14px] leading-6 text-zinc-500">No detailed prescription was saved for this session.</p>
              )}
            </section>

            {stravaActivity ? <div className="mt-5"><ActivityStatsPanel activity={stravaActivity} sportType={session.sport} plannedSession={session} /></div> : null}

            <section className="mt-5 rounded-2xl border border-[#E3E0D8] bg-[#F7F6F2] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">Athlete notes</div>
                <div className={clsx("text-[12px] font-semibold", notesStatus === "error" ? "text-rose-600" : "text-zinc-400")}>{statusText(notesStatus)}</div>
              </div>
              <textarea
                value={notesDraft}
                onChange={(event) => scheduleNotesSave(event.target.value)}
                onBlur={() => saveNotes(notesDraft)}
                placeholder="How did this feel? Add anything your coach should know."
                rows={4}
                className="mt-3 w-full resize-none rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#CFCBC1]"
              />
            </section>

            {coachReplyVisible ? (
              <section className="mt-5 rounded-2xl border border-[#D7DDFF] bg-[#F7FAFF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2563FF]">Coach reply</div>
                  <div className="text-[12px] font-semibold text-[#2563FF]">{coachReplyReady ? "Ready" : "Pending"}</div>
                </div>
                {coachReplyReady ? (
                  <p className="mt-3 text-[15px] leading-6 text-zinc-800">{session.coach_response}</p>
                ) : (
                  <p className="mt-3 text-[14px] leading-6 text-zinc-600">Your coach will respond after the next training review.</p>
                )}
              </section>
            ) : null}

            <section className="mt-5 rounded-2xl border border-[#E3E0D8] bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">Completion</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => updateStatus("done")} disabled={marking || (isFutureSession && manualStatus !== "done")} className={clsx("rounded-full border px-4 py-3 text-[13px] font-black transition", isCompleted ? "border-[#2563FF] bg-[#2563FF] text-white" : "border-[#E3E0D8] bg-white text-[#101114] hover:border-[#CFCBC1] disabled:cursor-not-allowed disabled:opacity-45")}>
                  {isFutureSession && manualStatus !== "done" ? "Locked until day-of" : manualStatus === "done" ? "Undo done" : "Mark done"}
                </button>
                <button type="button" onClick={() => updateStatus("skipped")} disabled={marking || Boolean(stravaActivity)} className={clsx("rounded-full border px-4 py-3 text-[13px] font-black transition", isSkipped ? "border-[#CFCBC1] bg-[#F7F6F2] text-[#101114]" : "border-[#E3E0D8] bg-white text-[#101114] hover:border-[#CFCBC1] disabled:opacity-50")}>
                  {isSkipped ? "Unskip" : "Skip"}
                </button>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#E3E0D8] bg-[#F7F6F2] px-6 py-4">
            <button type="button" onClick={handleDelete} className="text-[13px] font-medium text-zinc-400 hover:text-rose-600">Delete session</button>
            <button type="button" onClick={onClose} className="rounded-full border border-[#E3E0D8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#4B5563] hover:border-[#CFCBC1]">Close</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
