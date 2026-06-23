"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, endOfWeek, format, isAfter, isBefore, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type SensorOptions } from "@dnd-kit/core";
import Link from "next/link";

import AddSessionModalTP from "./AddSessionModalTP";
import MobileCalendarView from "./MobileCalendarView";
import MonthGrid from "./MonthGrid";
import ScheduleWeekGrid from "./ScheduleWeekGrid";
import SessionModal from "./SessionModal";
import StravaActivityModal from "./StravaActivityModal";
import { supabase } from "@/lib/supabase/client";
import { exportCalendarClient } from "@/utils/exportCalendarClient";
import { normalizeStravaActivities } from "@/utils/normalizeStravaActivities";
import type { CompletedSession } from "@/types/session";
import type { StravaActivity } from "@/types/strava";
import type { MergedSession } from "@/utils/mergeSessionWithStrava";

type Props = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  extraStravaActivities?: StravaActivity[];
  onCompletedUpdateAction?: (updated: CompletedSession[]) => void;
  timezone?: string;
  todaySummary?: string;
  nextSummary?: string;
  weekPhaseSummary?: string;
  raceGoal?: string | null;
  raceDate?: string | null;
  onOpenWalkthroughAction?: () => void;
  walkthroughLoading?: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type ViewMode = "week" | "month";

function cleanTitle(title?: string | null) {
  return String(title ?? "Untitled session").replace(/^\p{Extended_Pictographic}\s*/u, "").replace(/\s{2,}/g, " ").trim();
}

function sportLabel(value?: string | null) {
  const sport = String(value ?? "").toLowerCase();
  if (sport.includes("bike") || sport.includes("ride")) return "Bike";
  if (sport.includes("run")) return "Run";
  if (sport.includes("swim")) return "Swim";
  if (sport.includes("strength")) return "Strength";
  return "Session";
}

function sportKey(value?: string | null) {
  const sport = String(value ?? "").toLowerCase();
  if (sport.includes("swim")) return "swim";
  if (sport.includes("bike") || sport.includes("ride") || sport.includes("cycle")) return "bike";
  if (sport.includes("run")) return "run";
  if (sport.includes("strength") || sport.includes("gym")) return "strength";
  return "other";
}

function formatMinutes(minutes?: number | null) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function isSessionDone(session: MergedSession, completed: CompletedSession[]) {
  if (session.stravaActivity) return true;
  return completed.some((item) => item.date === session.date && item.session_title === session.title && (item.status ?? "done") === "done");
}

function statsForRange(sessions: MergedSession[], completed: CompletedSession[], start: Date, end: Date) {
  const weekSessions = sessions.filter((session) => {
    if (!session.date) return false;
    const date = parseISO(session.date);
    return date >= start && date <= end;
  });
  const minutes = weekSessions.reduce((sum, session) => sum + (typeof session.duration === "number" ? session.duration : 0), 0);
  const done = weekSessions.filter((session) => isSessionDone(session, completed)).length;
  return { sessions: weekSessions, planned: weekSessions.length, done, minutes, adherence: weekSessions.length ? Math.round((done / weekSessions.length) * 100) : 0 };
}

function getTodaySession(sessions: MergedSession[]) {
  return sessions.find((session) => session.date && isSameDay(parseISO(session.date), new Date())) ?? null;
}

function getNextSession(sessions: MergedSession[]) {
  const today = startOfDay(new Date());
  return sessions.filter((session) => session.date && parseISO(session.date) >= today).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[0] ?? null;
}

function previewDetails(details?: string | null) {
  const text = String(details ?? "").replace(/Purpose:\s*/gi, "").replace(/Workout:\s*/gi, "").replace(/Intensity:\s*/gi, "").split(/\n|\./).map((part) => part.trim()).find((part) => part.length > 16);
  if (!text) return "Open for targets, coach notes, and completion actions.";
  return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
}

function raceDisplayTitle(raceGoal?: string | null) {
  const label = String(raceGoal ?? "").trim();
  if (!label) return "Your race";
  const lower = label.toLowerCase();
  if (lower.includes("70.3") || lower.includes("half iron")) return "Your 70.3 race";
  if (lower.includes("ironman") || lower.includes("full")) return "Your Ironman race";
  if (lower.includes("olympic")) return "Your Olympic triathlon";
  if (lower.includes("sprint")) return "Your Sprint triathlon";
  return label;
}

function daysToRace(raceDate?: string | null) {
  if (!raceDate) return null;
  try {
    return Math.ceil((startOfDay(parseISO(raceDate)).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  } catch {
    return null;
  }
}

function sportMinutes(sessions: MergedSession[]) {
  return sessions.reduce(
    (acc, session) => {
      const key = sportKey(session.sport || session.title) as keyof typeof acc;
      acc[key] += typeof session.duration === "number" && Number.isFinite(session.duration) ? session.duration : 0;
      return acc;
    },
    { swim: 0, bike: 0, run: 0, strength: 0, other: 0 },
  );
}

function LoadPill({ label, minutes, color }: { label: string; minutes: number; color: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.08] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#BFC3D8]"><span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: color }} />{label}</div>
      <div className="mt-1 text-[15px] font-black text-white">{formatMinutes(minutes)}</div>
    </div>
  );
}

export default function CalendarShellV2({ sessions, completedSessions, extraStravaActivities = [], onCompletedUpdateAction, timezone = "America/Los_Angeles", weekPhaseSummary, raceGoal, raceDate = null, onOpenWalkthroughAction, walkthroughLoading }: Props) {
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [view, setView] = useState<ViewMode>("week");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);
  const [completed, setCompleted] = useState<CompletedSession[]>(completedSessions);
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setCompleted(completedSessions), [completedSessions]);
  useEffect(() => setLocalSessions(sessions), [sessions]);
  useEffect(() => onCompletedUpdateAction?.(completed), [completed, onCompletedUpdateAction]);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } } as SensorOptions),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } } as SensorOptions),
  );
  const currentWeekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);
  const weekly = useMemo(() => statsForRange(localSessions, completed, currentWeekStart, currentWeekEnd), [localSessions, completed, currentWeekStart, currentWeekEnd]);
  const load = useMemo(() => sportMinutes(weekly.sessions), [weekly.sessions]);
  const stravaByDate = useMemo(() => normalizeStravaActivities(extraStravaActivities, timezone), [extraStravaActivities, timezone]);
  const sessionsByDate = useMemo(() => {
    const map: Record<string, MergedSession[]> = {};
    localSessions.forEach((session) => {
      if (!session.date) return;
      map[session.date] = [...(map[session.date] ?? []), session];
    });
    return map;
  }, [localSessions]);

  const todaySession = useMemo(() => getTodaySession(localSessions), [localSessions]);
  const nextSession = useMemo(() => getNextSession(localSessions), [localSessions]);
  const commandSession = todaySession ?? nextSession ?? weekly.sessions[0] ?? null;
  const weekLabel = `${format(currentWeekStart, "MMM d")}–${format(currentWeekEnd, "MMM d")}`;
  const raceTitle = raceDisplayTitle(raceGoal);
  const raceCountdown = daysToRace(raceDate);
  const raceDateLabel = raceDate ? format(parseISO(raceDate), "EEE, MMM d") : null;
  const recentMissed = useMemo(() => {
    const cutoff = subDays(new Date(), 14);
    return localSessions.filter((session) => {
      if (!session.date || isAfter(parseISO(session.date), new Date()) || !isAfter(parseISO(session.date), cutoff)) return false;
      return !isSessionDone(session, completed);
    }).length;
  }, [localSessions, completed]);

  const handleCalendarExport = async () => {
    try { setExporting(true); await exportCalendarClient(); } finally { setExporting(false); }
  };

  const handleSessionDeleted = (sessionId: string) => {
    setLocalSessions((prev) => prev.filter((session) => String(session.id) !== String(sessionId)));
    setSelectedSession((prev) => (prev && String(prev.id) === String(sessionId) ? null : prev));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;
    const draggedId = String(active.id);
    const targetDate = String(over.id);
    let previousDate: string | null = null;
    setLocalSessions((prev) => prev.map((session) => {
      if (String(session.id) !== draggedId) return session;
      previousDate = String(session.date ?? "");
      return { ...session, date: targetDate };
    }));
    setSaveState("saving");
    setSaveMessage("Saving schedule change…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("sessions").update({ date: targetDate }).eq("id", draggedId);
      if (error) {
        console.error("[CalendarShell] error persisting session move:", error);
        if (previousDate) setLocalSessions((prev) => prev.map((session) => String(session.id) === draggedId ? { ...session, date: previousDate as string } : session));
        setSaveState("error");
        setSaveMessage("Could not save that move. Reverted to the original day.");
        return;
      }
      setSaveState("saved");
      setSaveMessage("Saved");
      window.setTimeout(() => { setSaveState("idle"); setSaveMessage(""); }, 1200);
    }, 450);
  };

  if (!mounted) return <main className="min-h-[100dvh] bg-white" />;
  if (mobile) {
    return (
      <main className="min-h-[100dvh] bg-white pb-[env(safe-area-inset-bottom)]">
        <MobileCalendarView sessions={localSessions} completedSessions={completed} stravaActivities={extraStravaActivities} onSessionDeleted={handleSessionDeleted} weekPhase={weekPhaseSummary ?? null} raceGoal={raceGoal ?? null} />
      </main>
    );
  }

  const raceHasPassed = (() => {
    if (!raceDate) return false;
    try { return isBefore(parseISO(raceDate), startOfDay(new Date())); } catch { return false; }
  })();

  return (
    <main className="min-h-[100dvh] bg-[#F7F7FB] text-[#11121A]">
      <div className="px-5 py-5 lg:px-8">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-black leading-none tracking-[-0.07em]">Schedule <span className="text-[18px] font-bold text-[#9EA4B7]">/ Season 2026</span></h1>
            <p className="mt-1 text-[13px] font-semibold text-[#6B7280]">{commandSession ? `Next: ${cleanTitle(commandSession.title)}` : "Your daily training command center"}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleCalendarExport} disabled={exporting} className="h-10 rounded-xl border border-[#E2E4EC] bg-white px-4 text-[13px] font-bold text-[#4B5563]">{exporting ? "Sharing…" : "Export"}</button>
            {onOpenWalkthroughAction ? <button type="button" onClick={onOpenWalkthroughAction} disabled={walkthroughLoading} className="hidden h-10 rounded-xl border border-[#E2E4EC] bg-white px-4 text-[13px] font-bold text-[#4B5563] sm:block">{walkthroughLoading ? "Opening…" : "Walkthrough"}</button> : null}
            <button type="button" onClick={() => setAddSessionDate(new Date())} className="h-10 rounded-xl bg-[#11121A] px-4 text-[13px] font-black text-white">+ Add session</button>
          </div>
        </header>

        <section className="mb-4 grid gap-4 xl:grid-cols-[1.05fr_1.3fr]">
          <div className="rounded-[24px] bg-[#090A12] p-5 text-white shadow-[0_18px_40px_rgba(8,10,18,0.16)]">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A9ADF3]">◎ Target race</div>
            <h2 className="mt-2 text-[25px] font-black tracking-[-0.055em]">{raceTitle}</h2>
            <div className="mt-3 flex items-end gap-3"><div className="text-[48px] font-black leading-[0.9] tracking-[-0.08em]">{raceCountdown !== null ? Math.max(raceCountdown, 0) : "—"}</div><div className="pb-1.5 text-[13px] font-semibold leading-snug text-[#C7CAE1]">{raceCountdown !== null ? "days out" : "plan active"}<br />{raceDateLabel ?? "Add race date"}</div></div>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[#AEB2C7]"><span>{weekPhaseSummary || "Active training block"}</span><strong>{weekly.adherence || 0}%</strong></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.12]"><div className="h-full rounded-full bg-[#9E92FF]" style={{ width: `${Math.max(weekly.adherence, 12)}%` }} /></div>
          </div>
          <div className="rounded-[24px] bg-[#090A12] p-5 text-white shadow-[0_18px_40px_rgba(8,10,18,0.16)]">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-[14px] font-black tracking-[-0.02em] text-[#D8DBEF]">Weekly load</h3><p className="mt-1 text-[12px] font-semibold text-[#8C90AA]">planned by sport · {weekLabel}</p></div><div className="text-[15px] font-black">{formatMinutes(weekly.minutes)}</div></div>
            <div className="mt-5 grid grid-cols-4 gap-3"><LoadPill label="Swim" minutes={load.swim} color="#34B7F1" /><LoadPill label="Bike" minutes={load.bike} color="#9B7CF6" /><LoadPill label="Run" minutes={load.run} color="#2FCB90" /><LoadPill label="Strength" minutes={load.strength} color="#C084FC" /></div>
          </div>
        </section>

        {raceHasPassed ? <div className="mb-4 rounded-2xl border border-[#D7DDFF] bg-[#EFF3FF] p-4 text-sm leading-6 text-[#1E3A8A]"><strong>Your race date has passed.</strong> Point the coach at your next race and a new plan renders in seconds. <Link href="/plan" className="font-black text-[#2563FF]">Plan my next race</Link></div> : null}

        <section className="mb-5 grid grid-cols-[42px_1fr] items-center gap-3 rounded-[18px] border border-[#D7D8FF] bg-gradient-to-r from-[#F7F7FF] to-white px-4 py-4 shadow-[0_14px_34px_rgba(19,21,39,0.06)]"><div className="grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#7667FF] to-[#A798FF] text-white">✣</div><div><div className="mb-1 text-[11px] font-black uppercase tracking-[0.13em] text-[#4F46E5]">{recentMissed > 0 ? "Coach adjusted this week" : "Coach is watching this week"}</div><p className="text-[14px] leading-6 text-[#31364A]">{recentMissed > 0 ? "Missed sessions are being absorbed, not stacked. Consistency beats catching up." : "Stay consistent this week and the Sunday adjustment can safely progress the plan."}</p></div></section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-[14px] border border-[#E7E9F1] bg-white p-1"><button type="button" onClick={() => setView("week")} className={`rounded-[11px] px-4 py-2 text-[14px] font-black ${view === "week" ? "bg-[#11121A] text-white" : "text-[#767C90]"}`}>Week</button><button type="button" onClick={() => setView("month")} className={`rounded-[11px] px-4 py-2 text-[14px] font-black ${view === "month" ? "bg-[#11121A] text-white" : "text-[#767C90]"}`}>Month</button></div><button type="button" onClick={() => view === "week" ? setCurrentWeekStart((d) => addDays(d, -7)) : setCurrentMonth((m) => subMonths(m, 1))} className="h-10 rounded-xl border border-[#E7E9F1] bg-white px-3">‹</button><button type="button" onClick={() => view === "week" ? setCurrentWeekStart((d) => addDays(d, 7)) : setCurrentMonth((m) => addMonths(m, 1))} className="h-10 rounded-xl border border-[#E7E9F1] bg-white px-3">›</button><button type="button" onClick={() => { setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setCurrentMonth(startOfMonth(new Date())); }} className="h-10 rounded-xl border border-[#E7E9F1] bg-white px-3 text-[13px] font-bold text-[#4B5563]">Today</button><div className="text-[20px] font-black tracking-[-0.04em]">{view === "week" ? weekLabel : format(currentMonth, "MMMM yyyy")}</div><div className="rounded-full bg-[#EFEDFF] px-3 py-1.5 text-[12px] font-black text-[#5548FF]">{weekPhaseSummary || "Base phase"}</div></div>
          <div className="text-[13px] font-bold text-[#666D81]">{formatMinutes(weekly.minutes)} planned · {weekly.done}/{weekly.planned || 0} done</div>
        </div>

        {commandSession ? <section className="mb-4 grid gap-4 rounded-[22px] border border-[#D8D6FF] bg-gradient-to-br from-[#F8F7FF] to-white p-4 shadow-[0_16px_38px_rgba(118,103,255,0.10)] xl:grid-cols-[1.1fr_1.2fr_auto]"><button type="button" onClick={() => setSelectedSession(commandSession)} className="rounded-[18px] border-l-[6px] border-l-[#9B7CF6] bg-white p-4 text-left"><div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#5146F0]">{todaySession ? `Today · ${sportLabel(commandSession.sport)}` : `Next · ${sportLabel(commandSession.sport)}`}</div><h2 className="text-[30px] font-black leading-none tracking-[-0.065em]">{cleanTitle(commandSession.title)}</h2><p className="mt-3 text-[14px] leading-6 text-[#687085]">{previewDetails(commandSession.details)}</p></button><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-[#E7E9F1] bg-white/80 p-3"><strong className="block text-[22px] tracking-[-0.05em]">{formatMinutes(commandSession.duration)}</strong><span className="text-[12px] font-semibold text-[#70778B]">Planned duration</span></div><div className="rounded-2xl border border-[#E7E9F1] bg-white/80 p-3"><strong className="block text-[22px] tracking-[-0.05em]">{commandSession.date ? format(parseISO(commandSession.date), "EEE, MMM d") : "—"}</strong><span className="text-[12px] font-semibold text-[#70778B]">Scheduled date</span></div><div className="rounded-2xl border border-[#E7E9F1] bg-white/80 p-3"><strong className="block text-[22px] tracking-[-0.05em]">Why</strong><span className="text-[12px] font-semibold text-[#70778B]">Open for coach read and targets.</span></div></div><div className="flex min-w-[150px] flex-col justify-center gap-2"><button type="button" onClick={() => setSelectedSession(commandSession)} className="rounded-xl bg-[#2F64FF] px-4 py-3 text-[13px] font-black text-white">Open session</button><button type="button" onClick={() => setAddSessionDate(commandSession.date ? parseISO(commandSession.date) : new Date())} className="rounded-xl border border-[#E7E9F1] bg-white px-4 py-3 text-[13px] font-bold text-[#4B5563]">Add nearby</button></div></section> : null}

        {saveState !== "idle" ? <div className={`mb-4 rounded-xl border px-4 py-3 text-[13px] font-medium ${saveState === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : saveState === "saving" ? "border-zinc-200 bg-white text-zinc-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{saveMessage}</div> : null}

        {view === "week" ? <ScheduleWeekGrid weekStart={currentWeekStart} sessions={weekly.sessions} completedSessions={completed} selectedSessionId={selectedSession?.id ?? commandSession?.id ?? null} onSessionClick={setSelectedSession} /> : <DndContext sensors={sensors} onDragEnd={handleDragEnd}><MonthGrid currentMonth={currentMonth} sessionsByDate={sessionsByDate} completedSessions={completed} stravaByDate={stravaByDate} onSessionClick={setSelectedSession} onStravaActivityClick={setSelectedActivity} onAddSessionClick={setAddSessionDate} /></DndContext>}
      </div>

      <SessionModal session={selectedSession} stravaActivity={selectedSession?.stravaActivity} open={!!selectedSession} onClose={() => setSelectedSession(null)} completedSessions={completed} onCompletedUpdate={(updated) => setCompleted(updated)} weekLabel={weekLabel} weekPhase={weekPhaseSummary ?? null} raceGoal={raceGoal ?? null} recentMissed={recentMissed} onSessionDeleted={handleSessionDeleted} onSessionUpdated={(updatedSession) => { setLocalSessions((prev) => prev.map((session) => String(session.id) === String(updatedSession.id) ? { ...session, ...updatedSession } : session)); setSelectedSession((prev) => prev && String(prev.id) === String(updatedSession.id) ? { ...prev, ...updatedSession } : prev); }} />
      <StravaActivityModal activity={selectedActivity} open={!!selectedActivity} onClose={() => setSelectedActivity(null)} timezone={timezone} />
      <AddSessionModalTP open={!!addSessionDate} date={addSessionDate ?? new Date()} onClose={() => setAddSessionDate(null)} onAdded={(newSession: MergedSession) => { setLocalSessions((prev) => [...prev, newSession]); setAddSessionDate(null); }} />
    </main>
  );
}
