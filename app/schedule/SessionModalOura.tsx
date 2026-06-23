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
type Range = { min: number; max: number };
type Segment = { label: string; minutes: number; target: string; watts?: number; color: string };
type IntensityKind = "recovery" | "endurance" | "tempo" | "threshold" | "vo2" | "race" | "strength" | "unknown";
type SideCardTone = "blue" | "green" | "amber" | "red" | "neutral";
type SideCard = { label: string; value: string | number; caption: string; tone?: SideCardTone };
type RecoveryScore = {
  date: string | null;
  readiness_score: number | string | null;
  sleep_score?: number | string | null;
  activity_score?: number | string | null;
  hrv?: number | string | null;
  resting_hr?: number | string | null;
};

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
  if (sport.includes("ride") || sport.includes("bike") || sport.includes("cycle")) return "Bike";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function isBike(value?: string | null) {
  const sport = String(value ?? "").toLowerCase();
  return sport.includes("bike") || sport.includes("ride") || sport.includes("cycle");
}

function isRun(value?: string | null) {
  const sport = String(value ?? "").toLowerCase();
  return sport.includes("run") || sport.includes("jog");
}

function isSwim(value?: string | null) {
  const sport = String(value ?? "").toLowerCase();
  return sport.includes("swim");
}

function inferIntensityKind(text: string): IntensityKind {
  const value = text.toLowerCase();
  if (/vo2|v02|max|anaerobic|sprint|z5/.test(value)) return "vo2";
  if (/threshold|ftp|cruise interval|z4|hard/.test(value)) return "threshold";
  if (/tempo|sweet spot|steady hard|z3/.test(value)) return "tempo";
  if (/race pace|race-pace|brick/.test(value)) return "race";
  if (/recovery|restorative|easy spin|very easy/.test(value)) return "recovery";
  if (/strength|mobility|core|lift/.test(value)) return "strength";
  if (/endurance|aerobic|easy|z2|steady/.test(value)) return "endurance";
  return "unknown";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value: unknown) {
  const next = typeof value === "string" ? Number(value) : value;
  return isFiniteNumber(next) ? next : null;
}

function formatMinutes(value?: number | null) {
  if (!isFiniteNumber(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatMovingTime(seconds?: number | null) {
  if (!isFiniteNumber(seconds) || seconds <= 0) return null;
  return formatMinutes(seconds / 60);
}

function formatDistance(meters?: number | null) {
  if (!isFiniteNumber(meters) || meters <= 0) return null;
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

function prescriptionText(session?: Pick<Session, "details" | "structured_workout"> | null) {
  return `${session?.details ?? ""}\n${session?.structured_workout ?? ""}`;
}

function parseRangeFromText(text: string, unitPattern: string): Range | null {
  const matches = Array.from(text.matchAll(new RegExp(`(\\d{2,4})\\s*(?:-|–|—|to)\\s*(\\d{2,4})\\s*(?:${unitPattern})`, "gi")));
  const ranges = matches
    .map((match) => ({ min: Number(match[1]), max: Number(match[2]) }))
    .filter((range) => range.min > 0 && range.max > range.min);
  if (!ranges.length) return null;
  return ranges.sort((a, b) => (b.min + b.max) / 2 - (a.min + a.max) / 2)[0];
}

function parsePowerTarget(text: string) {
  return parseRangeFromText(text, "w|watts");
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function daysBetweenDates(a: string, b: string) {
  const left = new Date(`${a}T00:00:00`).getTime();
  const right = new Date(`${b}T00:00:00`).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.round((right - left) / 86_400_000);
}

function formatDelta(plannedMinutes?: number | null, actualSeconds?: number | null) {
  if (!isFiniteNumber(plannedMinutes) || !isFiniteNumber(actualSeconds)) return null;
  const delta = Math.round(actualSeconds / 60 - plannedMinutes);
  if (Math.abs(delta) < 1) return "On target";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}m`;
}

function executionSummary(activity: StravaActivity, session: Session, powerTarget: Range | null) {
  const durationDelta = isFiniteNumber(session.duration) && isFiniteNumber(activity.moving_time) ? Math.round(activity.moving_time / 60 - session.duration) : null;
  const weightedPower = activity.weighted_average_watts ?? activity.average_watts ?? null;
  const highPower = Boolean(powerTarget && isFiniteNumber(weightedPower) && weightedPower > powerTarget.max);
  const lowPower = Boolean(powerTarget && isFiniteNumber(weightedPower) && weightedPower < powerTarget.min);
  const long = isFiniteNumber(durationDelta) && durationDelta >= 10;
  const short = isFiniteNumber(durationDelta) && durationDelta <= -10;

  if (highPower) {
    return {
      title: "Good consistency, but this ran hotter than prescribed.",
      analysisTitle: "A little hotter than planned",
      body: `Power drifted above the prescribed range${long ? " and the session ran long" : ""}. Good work, but treat the next easy session as actually easy.`,
      score: 78,
      tone: "hot" as const,
    };
  }
  if (lowPower || short) {
    return {
      title: "You got it done, but the effort came in light.",
      analysisTitle: "Lighter than planned",
      body: "The session still counts. Do not force missed volume into tomorrow — the plan works from what actually happened.",
      score: 72,
      tone: "light" as const,
    };
  }
  if (long) {
    return {
      title: "Solid execution, slightly longer than prescribed.",
      analysisTitle: "Slightly longer than planned",
      body: "Effort looks controlled, but the session ran longer than prescribed. That adds a little extra fatigue to the week.",
      score: 84,
      tone: "good" as const,
    };
  }
  return {
    title: "Clean execution. This matched the plan.",
    analysisTitle: "Effort matched the plan",
    body: "The completed activity lines up well with the prescribed session. Keep stacking these controlled executions.",
    score: 91,
    tone: "good" as const,
  };
}

function parseMinutesNear(text: string, pattern: RegExp, fallback: number) {
  const match = text.match(pattern);
  if (!match) return fallback;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseRangeNear(text: string, pattern: RegExp): Range | null {
  const match = text.match(pattern);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? { min, max } : null;
}

function rangeLabel(range: Range | null, fallback: string) {
  return range ? `${range.min}–${range.max} W` : fallback;
}

function rangeWatts(range: Range | null, fallback: number) {
  return range ? Math.round((range.min + range.max) / 2) : fallback;
}

function workoutSegments(target: Range | null, duration?: number | null, text = ""): Segment[] {
  const total = isFiniteNumber(duration) && duration > 0 ? Math.round(duration) : 55;
  const normalized = text.replace(/×/g, "x").replace(/\s+/g, " ").trim();
  const intervalMatch = normalized.match(/(\d+)\s*x\s*(\d+)\s*min[^\n.]*?(\d{2,4})\s*(?:-|–|—|to)\s*(\d{2,4})\s*(?:w|watts)[^\n.]*?(?:with|between)[^\n.]*?(\d+)\s*min[^\n.]*?(\d{2,4})\s*(?:-|–|—|to)\s*(\d{2,4})\s*(?:w|watts)/i);

  if (target && intervalMatch) {
    const reps = Number(intervalMatch[1]);
    const workMinutes = Number(intervalMatch[2]);
    const workRange = { min: Number(intervalMatch[3]), max: Number(intervalMatch[4]) };
    const recoveryMinutes = Number(intervalMatch[5]);
    const recoveryRange = { min: Number(intervalMatch[6]), max: Number(intervalMatch[7]) };
    const warmMinutes = parseMinutesNear(normalized, /(\d+)\s*min\s*warm/i, Math.min(10, Math.max(5, Math.round(total * 0.16))));
    const warmRange = parseRangeNear(normalized, /warm[^\n.]*?(\d{2,4})\s*(?:-|–|—|to)\s*(\d{2,4})\s*(?:w|watts)/i) ?? recoveryRange;
    const explicitCoolMinutes = parseMinutesNear(normalized, /cool(?:ing)?\s*down\s*(?:for)?\s*(\d+)\s*min/i, Math.min(10, Math.max(5, Math.round(total * 0.12))));
    const recoveryCount = /between/i.test(normalized) ? Math.max(0, reps - 1) : reps;
    const knownMinutes = warmMinutes + reps * workMinutes + recoveryCount * recoveryMinutes + explicitCoolMinutes;
    const coolMinutes = Math.max(explicitCoolMinutes, total > knownMinutes ? explicitCoolMinutes + (total - knownMinutes) : explicitCoolMinutes);
    const segments: Segment[] = [{ label: "Warm up", minutes: warmMinutes, target: rangeLabel(warmRange, "Easy"), watts: rangeWatts(warmRange, target.min - 35), color: "#B4B7C3" }];
    for (let index = 0; index < reps; index += 1) {
      segments.push({ label: `Interval ${index + 1}`, minutes: workMinutes, target: rangeLabel(workRange, `${target.min}–${target.max} W`), watts: rangeWatts(workRange, Math.round((target.min + target.max) / 2)), color: "#FF6A3D" });
      if (index < recoveryCount) segments.push({ label: "Recovery", minutes: recoveryMinutes, target: rangeLabel(recoveryRange, "Easy spin"), watts: rangeWatts(recoveryRange, Math.max(95, target.min - 60)), color: "#3B82F6" });
    }
    segments.push({ label: "Cool down", minutes: coolMinutes, target: rangeLabel(warmRange, "Easy"), watts: rangeWatts(warmRange, target.min - 35), color: "#B4B7C3" });
    return segments;
  }

  const warmMinutes = Math.min(10, Math.max(5, Math.round(total * 0.18)));
  const coolMinutes = warmMinutes;
  const mainMinutes = Math.max(10, total - warmMinutes - coolMinutes);
  const low = target?.min ?? 135;
  const high = target?.max ?? 165;
  return [
    { label: "Warm up", minutes: warmMinutes, target: target ? `${Math.max(80, low - 55)}–${Math.max(100, low - 15)} W` : "Easy", watts: Math.max(95, low - 40), color: "#B4B7C3" },
    { label: "Main set", minutes: mainMinutes, target: target ? `${low}–${high} W` : "Controlled effort", watts: Math.round((low + high) / 2), color: target && high >= 215 ? "#FF6A3D" : "#5EC15A" },
    { label: "Cool down", minutes: coolMinutes, target: target ? `${Math.max(80, low - 55)}–${Math.max(100, low - 15)} W` : "Easy", watts: Math.max(95, low - 40), color: "#B4B7C3" },
  ];
}

function loadCheckForSession(session: Session, recentMissed = 0): SideCard {
  const context = `${session.title ?? ""} ${prescriptionText(session)}`;
  const intensity = inferIntensityKind(context);

  if (intensity === "vo2") return { label: "Load check", value: "Hard day", caption: "Planned high-intensity work", tone: "red" };
  if (intensity === "threshold") return { label: "Load check", value: "Hard day", caption: "Threshold session", tone: "red" };
  if (intensity === "tempo" || intensity === "race") return { label: "Load check", value: "Controlled", caption: "Moderate quality work", tone: "amber" };
  if (intensity === "recovery") return { label: "Load check", value: "Recovery", caption: "Keep this truly easy", tone: "green" };
  if (intensity === "strength") return { label: "Load check", value: "Support", caption: "Strength maintenance", tone: "neutral" };
  if (recentMissed >= 2) return { label: "Load check", value: "Keep easy", caption: "Rebuilding consistency", tone: "green" };
  return { label: "Load check", value: "Normal", caption: "Aerobic training day", tone: "blue" };
}

function ouraReadinessCard(score: RecoveryScore | null, sessionDate: string): SideCard | null {
  const readiness = toNumber(score?.readiness_score);
  const recoveryDate = score?.date ?? null;
  if (readiness == null || !recoveryDate) return null;

  const today = dateOnly(new Date());
  const exactSessionDay = recoveryDate === sessionDate;
  const latestDelta = daysBetweenDates(recoveryDate, today);
  const latestForToday = sessionDate === today && latestDelta !== null && latestDelta >= 0 && latestDelta <= 1;
  if (!exactSessionDay && !latestForToday) return null;

  const rounded = Math.round(readiness);
  const sleep = toNumber(score?.sleep_score);
  const hrv = toNumber(score?.hrv);
  const captionParts = [];
  if (recoveryDate === today) captionParts.push("today");
  else captionParts.push(format(new Date(`${recoveryDate}T00:00:00`), "MMM d"));
  if (sleep != null) captionParts.push(`sleep ${Math.round(sleep)}`);
  else if (hrv != null) captionParts.push("HRV included");

  return {
    label: "Oura readiness",
    value: rounded,
    caption: captionParts.slice(0, 2).join(" · "),
    tone: rounded >= 80 ? "green" : rounded >= 70 ? "blue" : rounded >= 60 ? "amber" : "red",
  };
}

function getPreWorkoutSideCard(session: Session, recentMissed: number, recoveryScore: RecoveryScore | null) {
  return ouraReadinessCard(recoveryScore, session.date) ?? loadCheckForSession(session, recentMissed);
}

function getWorkoutFocus(session: Session, segments: Segment[], powerTarget: Range | null) {
  const context = `${session.title ?? ""} ${prescriptionText(session)}`;
  const intensity = inferIntensityKind(context);
  const sport = normalizeSport(session.sport);
  const workMinutes = segments.filter((segment) => segment.color === "#FF6A3D" || segment.label.includes("Main")).reduce((sum, segment) => sum + segment.minutes, 0);
  const targetLabel = powerTarget ? `${powerTarget.min}–${powerTarget.max} W` : null;

  if (isBike(`${session.sport} ${session.title}`) && intensity === "threshold") return { title: "Hit the work blocks, then actually recover.", body: targetLabel ? `The quality is ${workMinutes} minutes of controlled work around ${targetLabel}. Do not turn the recoveries into tempo riding — the next interval should feel repeatable, not desperate.` : "The quality is in the work blocks. Keep the recoveries honest so the final rep looks like the first." };
  if (isRun(`${session.sport} ${session.title}`) && intensity === "threshold") return { title: "Controlled hard. Not a time trial.", body: "Threshold work should feel sustainable and repeatable. Let heart rate climb through the early work, then settle near upper Z3 / Z4 without sprinting the last rep." };
  if (intensity === "tempo" || intensity === "race") return { title: `Lock into ${intensity === "race" ? "race rhythm" : "tempo"} and stay smooth.`, body: `${sport} quality today is about even pressure. Start slightly conservative, settle into the prescribed effort, and avoid turning the finish into a test.` };
  if (intensity === "vo2") return { title: "Make the hard parts hard and the easy parts easy.", body: "The recoveries are part of the workout, not dead time. Keep the first rep controlled enough that the last rep is still useful." };
  if (isSwim(`${session.sport} ${session.title}`)) return { title: "Stay long, relaxed, and technically clean.", body: "Hold form, keep the effort controlled, and make the last repeat look as clean as the first." };
  return { title: "Keep this aerobic and repeatable.", body: targetLabel ? `Today is about controlled aerobic work around ${targetLabel}. Respect the cap and finish fresher than you started.` : "Today is about controlled aerobic work. Stay smooth, avoid chasing extra intensity, and let the plan build from consistency." };
}

function LabelPill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "complete" | "hot" | "ready" }) {
  return <span className={clsx("rounded-full border px-2.5 py-1 text-[12px] font-semibold", tone === "default" && "border-zinc-200 bg-white text-zinc-600", tone === "complete" && "border-[#BBD1FF] bg-[#EAF0FF] font-black text-[#2563FF]", tone === "hot" && "border-[#FFD7B8] bg-[#FFF3E9] font-black text-[#A34500]", tone === "ready" && "border-emerald-200 bg-emerald-50 font-black text-emerald-700")}>{children}</span>;
}

function SideMetric({ card }: { card: SideCard }) {
  const toneClass = { blue: "border-[#DCE1FF] bg-white text-[#2563FF]", green: "border-emerald-200 bg-emerald-50 text-emerald-700", amber: "border-amber-200 bg-amber-50 text-amber-700", red: "border-[#FFD7B8] bg-[#FFF3E9] text-[#A34500]", neutral: "border-[#E7E9F1] bg-white text-[#101114]" }[card.tone ?? "neutral"];
  return <div className={clsx("rounded-[18px] border p-3 text-center sm:min-w-[116px]", toneClass)}><span className="block text-[10px] font-black uppercase tracking-[0.12em] opacity-75">{card.label}</span><strong className="mt-1 block text-[23px] leading-none tracking-[-0.06em] text-[#101114]">{card.value}</strong><span className="mt-1 block text-[11px] font-bold leading-4 text-[#7B8092]">{card.caption}</span></div>;
}

function CoachRead({ eyebrow, title, body, sideCard }: { eyebrow: string; title: string; body: string; sideCard?: SideCard }) {
  return <section className="mb-5 grid grid-cols-[42px_1fr] gap-3 rounded-[22px] border border-[#D7D9FF] bg-gradient-to-br from-[#F7F8FF] to-white p-4 shadow-[0_12px_30px_rgba(118,103,255,0.08)] sm:grid-cols-[42px_1fr_auto]"><div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-gradient-to-br from-[#7667FF] to-[#A699FF] text-white shadow-[0_12px_28px_rgba(118,103,255,0.24)]">✣</div><div><div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#4054FF]">{eyebrow}</div><h2 className="text-[22px] font-black leading-tight tracking-[-0.05em] text-[#101114]">{title}</h2><p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#40485B]">{body}</p></div>{sideCard ? <SideMetric card={sideCard} /> : null}</section>;
}

function WorkoutStructure({ segments }: { segments: Segment[] }) {
  return <section className="rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_12px_30px_rgba(19,21,39,0.045)]"><div className="flex items-center justify-between gap-3 border-b border-[#E7E9F1] bg-[#FCFCFF] px-4 py-4"><h3 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">Workout structure</h3><span className="text-[12px] font-bold text-[#7A8093]">Original prescription</span></div><div className="grid gap-2 p-4">{segments.map((segment, index) => <div key={`${segment.label}-${index}`} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-[12px] border border-[#E7E9F1] bg-[#FCFCFF] p-3 text-[13px]"><strong className="tracking-[-0.02em] text-[#101114]">{segment.minutes}m</strong><span className="font-bold text-[#687085]">{segment.label}</span><span className="text-right font-black text-[#101114]">{segment.target}</span></div>)}</div></section>;
}

function PowerBlocks({ segments }: { segments: Segment[] }) {
  const watts = segments.map((segment) => segment.watts ?? 0).filter((value) => value > 0);
  if (!watts.length) return null;
  const axisMax = Math.ceil((Math.max(...watts) + 35) / 25) * 25;
  const axisMin = Math.max(0, Math.floor((Math.min(...watts) - 25) / 25) * 25);
  const range = Math.max(1, axisMax - axisMin);
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const ticks = Array.from(new Set([axisMax, axisMax - 25, axisMax - 50, axisMax - 75, axisMin].filter((value) => value >= axisMin))).sort((a, b) => b - a);
  return <section className="rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_12px_30px_rgba(19,21,39,0.045)]"><div className="flex items-start justify-between gap-3 border-b border-[#E7E9F1] bg-[#FCFCFF] px-4 py-4"><div><h3 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">Power targets</h3><p className="mt-1 text-[12px] font-bold text-[#7A8093]">Each block is a prescribed interval. Watts are shown inside the chart.</p></div><span className="text-[12px] font-bold text-[#7A8093]">{total} min total</span></div><div className="p-4"><div className="relative h-[220px] overflow-hidden rounded-2xl bg-[#FCFCFF] pb-10 pl-[58px] pr-4 pt-4">{ticks.map((value) => { const top = 16 + ((axisMax - value) / range) * 154; return <div key={value} className="absolute left-4 right-4 border-t border-[#E7E8F1]" style={{ top }}><span className="absolute -top-2.5 left-0 rounded-md bg-[#FCFCFF] pr-1 text-[11px] font-bold text-[#7D8396]">{value}w</span></div>; })}<div className="absolute bottom-10 left-[58px] right-4 top-4 flex items-end overflow-hidden rounded-xl border border-[#E7E9F1] bg-white/40">{segments.map((segment, index) => { const height = clampPercent((((segment.watts ?? axisMin) - axisMin) / range) * 100); const width = `${Math.max(5, (segment.minutes / total) * 100)}%`; return <div key={`${segment.label}-${index}`} className="flex h-full flex-col justify-end border-r border-white/70 last:border-r-0" style={{ width }} title={`${segment.label}: ${segment.target}`}><div className="min-h-[8px] w-full" style={{ height: `${height}%`, backgroundColor: segment.color }} /></div>; })}</div><div className="absolute bottom-3 left-[58px] right-4 flex justify-between text-[11px] font-bold text-[#7D8396]"><span>0:00</span><span>{Math.max(1, total - Math.min(10, total))}m</span><span>{total}m</span></div></div></div></section>;
}

function heartRateGuideForSession(session: Session) {
  const context = `${session.title ?? ""} ${prescriptionText(session)}`;
  const intensity = inferIntensityKind(context);
  if (intensity === "threshold") return { subtitle: "Threshold effort", title: isRun(`${session.sport} ${session.title}`) ? "Let HR rise, then hold the line" : "Power leads. HR confirms the cost.", body: isRun(`${session.sport} ${session.title}`) ? "For threshold running, HR usually lags early and climbs into upper Z3 / Z4. The warning sign is hitting Z5 before the final work block." : "For threshold bike work, power is the target. HR should climb during the reps, but it should not spiral early enough to compromise the final interval.", watch: "Drift", expected: "Z3–Z4", backOff: "Z5 early", cue: "Even reps", highlightStart: 40, highlightWidth: 40, highlightText: "Best range for today: upper aerobic into threshold, not a max effort." };
  if (intensity === "tempo" || intensity === "race") return { subtitle: "Tempo effort", title: "Settle into pressure you can repeat", body: "HR can sit around Z3, but avoid turning the back half into threshold unless the workout says so.", watch: "Creep", expected: "Z3", backOff: "Z4+", cue: "Smooth", highlightStart: 40, highlightWidth: 20, highlightText: "Best range for today: steady tempo pressure." };
  return { subtitle: "Aerobic guardrail", title: isBike(`${session.sport} ${session.title}`) ? "Power is the target; HR is the check" : "Keep the effort aerobic", body: isBike(`${session.sport} ${session.title}`) ? "Use HR to catch heat, fatigue, dehydration, or excessive drift. If HR keeps climbing while power stays the same, back off slightly." : "This should sit mostly in Z2. If it climbs into sustained Z3, slow down and keep the session aerobic.", watch: "Drift", expected: "Z2", backOff: "High Z3+", cue: "Controlled", highlightStart: 20, highlightWidth: 20, highlightText: "Best range for today: easy aerobic / controlled." };
}

function HeartRateGuardrail({ session }: { session: Session }) {
  const guide = heartRateGuideForSession(session);
  return <section className="rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_12px_30px_rgba(19,21,39,0.045)]"><div className="flex items-start justify-between gap-3 border-b border-[#E7E9F1] bg-[#FCFCFF] px-4 py-4"><div><h3 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">Heart rate guide</h3><p className="mt-1 text-[12px] font-bold text-[#7A8093]">Specific to this workout’s intensity.</p></div><span className="text-[12px] font-bold text-[#7A8093]">{guide.subtitle}</span></div><div className="p-4"><div className="rounded-2xl bg-[#FCFCFF] p-4"><h4 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">{guide.title}</h4><p className="mt-1 text-[13px] leading-5 text-[#687085]">{guide.body}</p><div className="mt-4 grid gap-2 sm:grid-cols-4"><div className="rounded-xl border border-[#E2E7FF] bg-[#F4F7FF] p-3"><span className="text-[12px] font-bold text-[#687085]">Watch for</span><strong className="mt-1 block text-[22px] tracking-[-0.05em]">{guide.watch}</strong></div><div className="rounded-xl border border-[#D8F5E6] bg-[#F7FFF9] p-3"><span className="text-[12px] font-bold text-[#687085]">Expected</span><strong className="mt-1 block text-[22px] tracking-[-0.05em]">{guide.expected}</strong></div><div className="rounded-xl border border-[#FDE8B7] bg-[#FFFAF0] p-3"><span className="text-[12px] font-bold text-[#687085]">Back off if</span><strong className="mt-1 block text-[22px] tracking-[-0.05em]">{guide.backOff}</strong></div><div className="rounded-xl border border-[#E7E8EF] bg-white p-3"><span className="text-[12px] font-bold text-[#687085]">Cue</span><strong className="mt-1 block text-[18px] tracking-[-0.04em]">{guide.cue}</strong></div></div><div className="mt-5"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#9AA0B2]">Heart rate zones</div><div className="mt-2 grid grid-cols-5 overflow-hidden rounded-xl text-center text-[11px] font-black text-[#263043]"><div className="bg-[#E8F2FF] py-2">Z1</div><div className="bg-[#DFF7EA] py-2">Z2</div><div className="bg-[#FFF2BF] py-2">Z3</div><div className="bg-[#FFD7C2] py-2">Z4</div><div className="bg-[#F9B4B4] py-2">Z5</div></div><div className="mt-2 h-1.5 rounded-full bg-[#32D39A]" style={{ marginLeft: `${guide.highlightStart}%`, width: `${guide.highlightWidth}%` }} /><p className="mt-2 text-[12px] font-bold text-[#087A52]">{guide.highlightText}</p></div></div></div></section>;
}

function ChartBar({ label, value, width, tone }: { label: string; value: string | null; width: number; tone: "blue" | "muted" | "orange" }) {
  const fillClass = tone === "blue" ? "bg-[#2563FF]" : tone === "orange" ? "bg-[#FF6A00]" : "bg-zinc-300";
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]"><span className="font-medium text-zinc-500">{label}</span><span className="font-semibold text-zinc-950">{value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-zinc-100"><div className={`${fillClass} h-full rounded-full`} style={{ width: `${clampPercent(width)}%` }} /></div></div>;
}

function DurationBars({ plannedMinutes, actualSeconds }: { plannedMinutes?: number | null; actualSeconds?: number | null }) {
  if (!isFiniteNumber(plannedMinutes) || !isFiniteNumber(actualSeconds)) return null;
  const completedMinutes = Math.round(actualSeconds / 60);
  const max = Math.max(plannedMinutes, completedMinutes, 1);
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div className="text-[13px] font-semibold text-zinc-950">Duration</div><div className="text-[12px] font-semibold text-zinc-500">{formatDelta(plannedMinutes, actualSeconds)}</div></div><div className="mt-4 space-y-3"><ChartBar label="Planned" value={formatMinutes(plannedMinutes)} width={(plannedMinutes / max) * 100} tone="muted" /><ChartBar label="Completed" value={formatMinutes(completedMinutes)} width={(completedMinutes / max) * 100} tone="blue" /></div></div>;
}

function TargetBandChart({ title, target, values, unit }: { title: string; target: Range | null; values: Array<{ label: string; value: number | null | undefined }>; unit: string }) {
  const cleanValues = values.filter((item): item is { label: string; value: number } => isFiniteNumber(item.value) && item.value > 0);
  if (!cleanValues.length) return null;
  const maxValue = Math.max(target?.max ?? 0, ...cleanValues.map((item) => item.value));
  const scaleMax = Math.max(1, Math.ceil(maxValue * 1.18));
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[13px] font-semibold text-zinc-950">{title}</div><div className="mt-0.5 text-[12px] font-medium text-zinc-500">{target ? `Target ${target.min}-${target.max} ${unit}` : "Synced from Strava"}</div><div className="mt-5 space-y-4">{target ? <div><div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400"><span>Target band</span><span>{scaleMax} {unit}</span></div><div className="relative h-3 rounded-full bg-zinc-100"><div className="absolute top-0 h-3 rounded-full bg-[#C6F33C]" style={{ left: `${clampPercent((target.min / scaleMax) * 100)}%`, width: `${clampPercent(((target.max - target.min) / scaleMax) * 100)}%` }} /></div></div> : null}{cleanValues.map((item) => { const width = clampPercent((item.value / scaleMax) * 100); const above = target ? item.value > target.max : false; const below = target ? item.value < target.min : false; return <ChartBar key={item.label} label={item.label} value={`${Math.round(item.value)} ${unit}`} width={width} tone={below ? "muted" : above ? "orange" : "blue"} />; })}</div></div>;
}

function PostWorkoutAnalysis({ session, activity, target }: { session: Session; activity: StravaActivity; target: Range | null }) {
  const summary = executionSummary(activity, session, target);
  const hasPower = isFiniteNumber(activity.average_watts) || isFiniteNumber(activity.weighted_average_watts);
  const hasHeartRate = isFiniteNumber(activity.average_heartrate) || isFiniteNumber(activity.max_heartrate);
  return <section className="rounded-[22px] border border-[#D7D9FF] bg-[#F7FAFF] p-4"><div className="mb-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2563FF]">Effort analysis</div><h3 className="mt-1 text-[21px] font-black tracking-[-0.05em] text-zinc-950">{summary.analysisTitle}</h3><p className="mt-1.5 text-[13px] leading-5 text-zinc-600">{summary.body}</p></div><div className="grid gap-3 md:grid-cols-3"><DurationBars plannedMinutes={session.duration ?? null} actualSeconds={activity.moving_time} />{hasPower ? <TargetBandChart title="Power" target={target} unit="W" values={[{ label: "Avg watts", value: activity.average_watts }, { label: "Weighted watts", value: activity.weighted_average_watts }]} /> : null}{hasHeartRate ? <TargetBandChart title="Heart rate" target={null} unit="bpm" values={[{ label: "Avg HR", value: activity.average_heartrate }, { label: "Max HR", value: activity.max_heartrate }]} /> : null}</div><div className="mt-4"><ActivityStatsPanel activity={activity} sportType={session.sport} plannedSession={session} compact /></div></section>;
}

function checklistForSession(session: Session, powerTarget: Range | null) {
  const context = `${session.title ?? ""} ${prescriptionText(session)}`;
  const intensity = inferIntensityKind(context);
  const bike = isBike(`${session.sport} ${session.title}`);
  const run = isRun(`${session.sport} ${session.title}`);
  if (bike && intensity === "threshold") return [["Hit the interval range", powerTarget ? `Work blocks should sit around ${powerTarget.min}–${powerTarget.max} W. Avoid surging above the cap in the first half.` : "Hold the prescribed work effort without spiking early."], ["Recover properly", "Easy blocks should feel easy. If recovery power creeps up, the next interval gets worse."], ["Keep cadence smooth", "Use the same gear/cadence feel across the reps so power does not become choppy."], ["Sync after", "Strava will tell us if the work blocks were controlled or if the session turned into a grind."]];
  if (run && intensity === "threshold") return [["Start controlled", "The first rep should feel almost too controlled. Threshold is about repeatability, not proving fitness early."], ["HR will lag", "Do not chase heart rate in the first few minutes. Let it climb naturally toward upper Z3 / Z4."], ["Protect the last rep", "If you need to sprint to hit the target, you are overcooking it. Smooth pressure wins."], ["Leave notes", "Tell the coach if breathing, legs, or heat changed the effort."]];
  return [["Keep it controlled", bike && powerTarget ? `Stay mostly inside ${powerTarget.min}–${powerTarget.max} W and avoid bonus intensity.` : "This should feel smooth and repeatable, not like a fitness test."], ["Watch drift", "If effort rises while output stays flat, back off slightly and protect tomorrow."], ["Fuel normally", "Water is fine for short aerobic work. Add carbs if you are stacking sessions or going long."], ["Sync after", "Strava lets the coach compare planned vs actual and adapt the plan."]];
}

function Checklist({ session, powerTarget }: { session: Session; powerTarget: Range | null }) {
  const items = checklistForSession(session, powerTarget);
  return <section className="rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_12px_30px_rgba(19,21,39,0.045)]"><div className="flex items-center justify-between gap-3 border-b border-[#E7E9F1] bg-[#FCFCFF] px-4 py-4"><h3 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">Before you start</h3><span className="text-[12px] font-bold text-[#7A8093]">Session-specific</span></div><div className="grid gap-3 p-4">{items.map(([title, body]) => <div key={title} className="grid grid-cols-[26px_1fr] gap-2.5"><span className="grid h-6 w-6 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-[13px] font-black text-emerald-700">✓</span><div><strong className="block text-[14px] tracking-[-0.02em]">{title}</strong><span className="text-[13px] leading-5 text-[#687085]">{body}</span></div></div>)}</div></section>;
}

export default function SessionModal({ session, stravaActivity, open, onClose, completedSessions, onCompletedUpdate, onSessionDeleted, onSessionUpdated, recentMissed = 0, raceGoal }: Props) {
  const [marking, setMarking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesStatus, setNotesStatus] = useState<NotesStatus>("idle");
  const [ouraRecovery, setOuraRecovery] = useState<RecoveryScore | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotes = useRef("");

  useEffect(() => { const notes = session?.athlete_notes ?? ""; setNotesDraft(notes); lastSavedNotes.current = notes; setNotesStatus("idle"); setErrorMessage(null); }, [session?.id, session?.athlete_notes]);
  useEffect(() => { if (!open || !session?.id) return; track("session_opened", { sport: session.sport || "unknown", date: session.date || null, is_planned: true }); }, [open, session?.id, session?.sport, session?.date]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  useEffect(() => {
    if (!open || !session?.date) { setOuraRecovery(null); return; }
    let cancelled = false;
    async function loadOuraReadiness() {
      setOuraRecovery(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;
        const { data, error } = await supabase.from("daily_recovery_scores").select("date,readiness_score,sleep_score,activity_score,hrv,resting_hr").eq("user_id", userId).eq("provider", "oura").lte("date", session.date).order("date", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (!cancelled) setOuraRecovery((data as RecoveryScore | null) ?? null);
      } catch (error) {
        console.warn("[SessionModal] Oura readiness unavailable", error);
        if (!cancelled) setOuraRecovery(null);
      }
    }
    loadOuraReadiness();
    return () => { cancelled = true; };
  }, [open, session?.date, session?.id]);

  const manualStatus = useMemo<"done" | "skipped" | null>(() => { const match = completedSessions.find((item) => item.date === session?.date && item.session_title === session?.title); if (!match) return null; return match.status === "skipped" ? "skipped" : "done"; }, [completedSessions, session?.date, session?.title]);
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
  const fullPrescription = prescriptionText(session);
  const powerTarget = isBike(session.sport || session.title) ? parsePowerTarget(fullPrescription) : null;
  const segments = workoutSegments(powerTarget, session.duration, fullPrescription);
  const preWorkoutFocus = getWorkoutFocus(session, segments, powerTarget);
  const loadCheck = getPreWorkoutSideCard(session, recentMissed, ouraRecovery);
  const isCompleted = Boolean(stravaActivity) || manualStatus === "done";
  const isSkipped = !stravaActivity && manualStatus === "skipped";
  const coachReplyVisible = Boolean(notesDraft.trim());
  const coachReplyReady = session.coach_response_status === "generated" && Boolean(session.coach_response);
  const summary = stravaActivity ? executionSummary(stravaActivity, session, powerTarget) : null;
  const applyLocalStatus = (nextStatus: "done" | "skipped" | null) => { const base = completedSessions.filter((item) => item.date !== session.date || item.session_title !== session.title); if (!nextStatus) return base; return [...base, { date: session.date, session_title: session.title, status: nextStatus }]; };
  const updateStatus = async (mode: "done" | "skipped") => {
    if (mode === "done" && isFutureSession) { setErrorMessage("Future workouts cannot be marked complete yet. Move the session or wait until the workout day."); return; }
    setMarking(true); setErrorMessage(null); const previous = completedSessions; const shouldUndo = mode === "done" ? manualStatus === "done" : isSkipped; onCompletedUpdate(applyLocalStatus(shouldUndo ? null : mode));
    try { const { data: auth } = await supabase.auth.getUser(); const res = await fetch(mode === "done" ? "/api/schedule/mark-done" : "/api/schedule/mark-skip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_date: session.date, session_title: session.title, undo: shouldUndo, clientUserId: auth.user?.id ?? null }) }); const payload = await res.json().catch(() => ({})); if (!res.ok) { onCompletedUpdate(previous); setErrorMessage(payload?.error || "Could not update session status."); return; } const active = mode === "done" ? payload?.completed === true : payload?.skipped === true; onCompletedUpdate(applyLocalStatus(active ? mode : null)); } catch (error) { console.error(error); onCompletedUpdate(previous); setErrorMessage("Unexpected error updating session."); } finally { setMarking(false); }
  };
  const saveNotes = async (nextNotes: string) => { if (nextNotes === lastSavedNotes.current) { setNotesStatus("idle"); return; } setNotesStatus("saving"); setErrorMessage(null); try { const cleanNotes = nextNotes.trim() || null; const coachPatch = cleanNotes ? { coach_response: null, coach_response_status: "pending", coach_response_generated_at: null, coach_response_note_snapshot: cleanNotes } : { coach_response: null, coach_response_status: null, coach_response_generated_at: null, coach_response_note_snapshot: null }; const { error } = await supabase.from("sessions").update({ athlete_notes: cleanNotes, ...coachPatch }).eq("id", session.id); if (error) { setNotesStatus("error"); setErrorMessage("Could not save notes."); return; } lastSavedNotes.current = nextNotes; setNotesStatus("saved"); onSessionUpdated?.({ ...session, athlete_notes: cleanNotes, ...coachPatch }); window.setTimeout(() => setNotesStatus("idle"), 1200); } catch (error) { console.error(error); setNotesStatus("error"); setErrorMessage("Unexpected error saving notes."); } };
  const scheduleNotesSave = (nextNotes: string) => { setNotesDraft(nextNotes); setNotesStatus(nextNotes === lastSavedNotes.current ? "idle" : "dirty"); if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => saveNotes(nextNotes), 700); };
  const handleDelete = async () => { const confirmed = window.confirm("Delete this session from your calendar?"); if (!confirmed) return; const { error } = await supabase.from("sessions").delete().eq("id", session.id); if (error) { setErrorMessage("Could not delete this session."); return; } onSessionDeleted?.(session.id); onClose(); };

  return <Dialog open={open} onClose={onClose} className="relative z-50"><div className="fixed inset-0 bg-[#101114]/30 backdrop-blur-[2px]" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"><Dialog.Panel className="flex max-h-[88vh] w-full max-w-[940px] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_42px_110px_rgba(9,10,18,0.30)]"><div className="border-b border-[#E7E9F1] bg-gradient-to-br from-white via-[#FBFAFF] to-[#F2F0FF] px-6 py-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2"><LabelPill>{sport}</LabelPill><LabelPill>{formattedDate}</LabelPill>{isCompleted ? <LabelPill tone="complete">Complete</LabelPill> : <LabelPill tone="ready">Ready to train</LabelPill>}{summary?.tone === "hot" ? <LabelPill tone="hot">A little hot</LabelPill> : null}{isSkipped ? <LabelPill>Skipped</LabelPill> : null}</div><Dialog.Title className="text-[34px] font-black leading-[0.96] tracking-[-0.07em] text-[#101114]">{title}</Dialog.Title><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-[#586174]">{plannedDuration ? <span>Planned <strong className="text-[#101114]">{plannedDuration}</strong></span> : null}{completedDuration ? <span>Completed <strong className="text-[#101114]">{completedDuration}</strong></span> : null}{completedDistance ? <span><strong className="text-[#101114]">{completedDistance}</strong></span> : null}{raceGoal ? <span>{raceGoal}</span> : null}</div></div><button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E7E9F1] bg-white text-[#6B7280] hover:border-[#CFCBC1] hover:bg-white"><XIcon className="h-5 w-5" /></button></div></div><div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-5">{errorMessage ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{errorMessage}</div> : null}{stravaActivity ? <CoachRead eyebrow="Coach read" title={summary?.title ?? "Workout synced."} body={summary?.body ?? "Your completed activity is synced from Strava."} sideCard={{ label: "Execution score", value: summary?.score ?? 80, caption: "Actual vs planned", tone: summary?.tone === "hot" ? "amber" : "green" }} /> : <CoachRead eyebrow="Today’s focus" title={preWorkoutFocus.title} body={preWorkoutFocus.body} sideCard={loadCheck} />}{stravaActivity ? <PostWorkoutAnalysis session={session} activity={stravaActivity} target={powerTarget} /> : <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div className="grid gap-5"><WorkoutStructure segments={segments} />{isBike(session.sport || session.title) ? <PowerBlocks segments={segments} /> : null}<HeartRateGuardrail session={session} /></div><div className="grid content-start gap-5"><Checklist session={session} powerTarget={powerTarget} /><section className="rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_12px_30px_rgba(19,21,39,0.045)]"><div className="flex items-center justify-between gap-3 border-b border-[#E7E9F1] bg-[#FCFCFF] px-4 py-4"><h3 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">Why this workout</h3><span className="text-[12px] font-bold text-[#7A8093]">Coach rationale</span></div><div className="grid gap-3 p-4 text-[14px] leading-6 text-[#3F4658]">{details ? details.split("\n").slice(0, 4).map((line) => <p key={line}>{line}</p>) : <p>No detailed prescription was saved for this session.</p>}</div></section></div></div>}{stravaActivity ? <section className="mt-5 rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_12px_30px_rgba(19,21,39,0.045)]"><div className="flex items-center justify-between gap-3 border-b border-[#E7E9F1] bg-[#FCFCFF] px-4 py-4"><h3 className="text-[16px] font-black tracking-[-0.035em] text-[#101114]">Workout info</h3><span className="text-[12px] font-bold text-[#7A8093]">Original prescription</span></div><div className="grid gap-3 p-4 text-[14px] leading-6 text-[#3F4658]">{details ? details.split("\n").map((line) => <p key={line}>{line}</p>) : <p>No detailed prescription was saved for this session.</p>}</div></section> : null}<section className="mt-5 rounded-[22px] border border-[#E7E9F1] bg-[#FFFDF9] p-4"><div className="flex items-center justify-between gap-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">Athlete notes</div><div className={clsx("text-[12px] font-semibold", notesStatus === "error" ? "text-rose-600" : "text-zinc-400")}>{statusText(notesStatus)}</div></div><textarea value={notesDraft} onChange={(event) => scheduleNotesSave(event.target.value)} onBlur={() => saveNotes(notesDraft)} placeholder="How did this feel? Add anything your coach should know." rows={4} className="mt-3 w-full resize-none rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#CFCBC1]" /></section>{coachReplyVisible ? <section className="mt-5 rounded-[22px] border border-[#D7DDFF] bg-[#F7FAFF] p-4"><div className="flex items-center justify-between gap-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2563FF]">Coach reply</div><div className="text-[12px] font-semibold text-[#2563FF]">{coachReplyReady ? "Ready" : "Pending"}</div></div>{coachReplyReady ? <p className="mt-3 text-[15px] leading-6 text-zinc-800">{session.coach_response}</p> : <p className="mt-3 text-[14px] leading-6 text-zinc-600">Your coach will respond after the next training review.</p>}</section> : null}<section className="mt-5 rounded-[22px] border border-[#E7E9F1] bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">Completion</div><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => updateStatus("done")} disabled={marking || (isFutureSession && manualStatus !== "done")} className={clsx("rounded-full border px-4 py-3 text-[13px] font-black transition", isCompleted ? "border-[#2563FF] bg-[#2563FF] text-white" : "border-[#E3E0D8] bg-white text-[#101114] hover:border-[#CFCBC1] disabled:cursor-not-allowed disabled:opacity-45")}>{isFutureSession && manualStatus !== "done" ? "Locked until day-of" : manualStatus === "done" ? "Undo done" : "Mark done"}</button><button type="button" onClick={() => updateStatus("skipped")} disabled={marking || Boolean(stravaActivity)} className={clsx("rounded-full border px-4 py-3 text-[13px] font-black transition", isSkipped ? "border-[#CFCBC1] bg-[#F7F6F2] text-[#101114]" : "border-[#E3E0D8] bg-white text-[#101114] hover:border-[#CFCBC1] disabled:opacity-50")}>{isSkipped ? "Unskip" : "Skip"}</button></div></section></div><div className="flex items-center justify-between gap-3 border-t border-[#E7E9F1] bg-[#FFFDFA] px-6 py-4"><button type="button" onClick={handleDelete} className="text-[13px] font-medium text-zinc-400 hover:text-rose-600">Delete session</button><button type="button" onClick={onClose} className="rounded-full border border-[#E3E0D8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#4B5563] hover:border-[#CFCBC1]">Close</button></div></Dialog.Panel></div></Dialog>;
}
