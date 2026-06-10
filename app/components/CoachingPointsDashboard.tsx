"use client";

import type { ReactNode } from "react";

import {
  addDays,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import type { Session } from "@/types/session";
import type { StravaActivity } from "@/types/strava";
import FitnessPanel from "@/app/coaching/FitnessPanel";
import StravaConnectBanner from "@/app/components/StravaConnectBanner";
import type { CoachingContextPayload } from "@/types/coaching-context";

type CompletedRow = {
  user_id?: string;
  date?: string | null;
  session_date?: string | null;
  session_title?: string | null;
  title?: string | null;
  sport?: string | null;
  duration?: number | null;
  status?: "done" | "skipped" | string | null;
};

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: CompletedRow[];
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: unknown;
  stravaConnected: boolean;
  raceDate?: string | null;
  initialPrompt?: string;
  initialContext?: CoachingContextPayload | null;
};

type SportBucket = "Swim" | "Bike" | "Run" | "Strength" | "Other";

function safeParseDate(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function isWithinRange(date: Date, start: Date, end: Date) {
  return !isBefore(date, start) && !isAfter(date, end);
}

function getCompletedDate(row: CompletedRow) {
  return row.session_date ?? row.date ?? undefined;
}

function getCompletedTitle(row: CompletedRow) {
  return row.session_title ?? row.title ?? "";
}

function estimateDurationFromTitle(title?: string | null) {
  if (!title) return 45;
  const hours = title.match(/(\d{1,3}(?:\.\d+)?)\s*(hr|hour|hours)/i);
  if (hours) {
    const parsed = Number.parseFloat(hours[1]);
    if (Number.isFinite(parsed)) return Math.round(parsed * 60);
  }
  const mins = title.match(/(\d{1,3})\s*min/i);
  if (mins) {
    const parsed = Number.parseInt(mins[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 45;
}

function sessionDurationMinutes(session: Session) {
  if (typeof session.duration === "number" && Number.isFinite(session.duration))
    return Math.max(0, session.duration);
  return estimateDurationFromTitle(session.title);
}

function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function normalizeSport(input?: string | null): SportBucket {
  const value = String(input ?? "").toLowerCase();
  if (value.includes("swim")) return "Swim";
  if (
    value.includes("bike") ||
    value.includes("ride") ||
    value.includes("virtualride")
  )
    return "Bike";
  if (value.includes("run")) return "Run";
  if (value.includes("strength") || value.includes("gym")) return "Strength";
  return "Other";
}

function sportDotClass(sport?: string | null) {
  const normalized = normalizeSport(sport);
  if (normalized === "Swim") return "bg-[#0E8FA0]";
  if (normalized === "Bike") return "bg-[#FF6A00]";
  if (normalized === "Run") return "bg-[#C6F33C]";
  if (normalized === "Strength") return "bg-[#7C3AED]";
  return "bg-zinc-400";
}

function getActivityDate(activity: StravaActivity) {
  return safeParseDate(activity.start_date_local || activity.start_date);
}

function sessionPriority(session: Session) {
  const title =
    `${session.title ?? ""} ${session.details ?? ""} ${session.purpose ?? ""}`.toLowerCase();
  const duration = sessionDurationMinutes(session);
  let score = 0;
  if (title.includes("long")) score += 8;
  if (title.includes("brick")) score += 8;
  if (title.includes("threshold")) score += 7;
  if (title.includes("tempo")) score += 6;
  if (title.includes("interval")) score += 6;
  if (title.includes("race")) score += 5;
  if (title.includes("endurance")) score += 3;
  if (duration >= 90) score += 4;
  if (duration >= 150) score += 4;
  if (session.sport === "Rest") score -= 10;
  return score;
}

function calculateSessionPoints(input: {
  sport?: string | null;
  title?: string | null;
  durationMinutes: number;
}) {
  const sport = normalizeSport(input.sport);
  const title = String(input.title ?? "").toLowerCase();
  const duration = Math.max(0, input.durationMinutes);
  let points = Math.round(duration / 10) * 5;
  if (sport === "Bike") points += Math.round(duration / 30) * 3;
  if (sport === "Run") points += Math.round(duration / 25) * 3;
  if (sport === "Swim") points += 8;
  if (title.includes("long")) points += 18;
  if (title.includes("brick")) points += 16;
  if (title.includes("threshold") || title.includes("interval")) points += 14;
  if (title.includes("tempo")) points += 10;
  if (title.includes("recovery") || title.includes("easy")) points -= 4;
  if (input.sport === "Rest") return 0;
  return Math.max(10, Math.min(points, 110));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getSessionDateLabel(session: Session) {
  const parsed = safeParseDate(session.date);
  return parsed ? format(parsed, "EEE, MMM d") : "Date TBD";
}

function raceCountdown(raceDate?: string | null) {
  const race = safeParseDate(raceDate);
  if (!race) return null;
  return Math.max(
    0,
    Math.ceil(
      (startOfDay(race).getTime() - startOfDay(new Date()).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E3E0D8] bg-white p-4 sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#101114]">
        {value}
      </p>
      <p className="mt-1 text-sm leading-5 text-[#6B7280]">{detail}</p>
    </div>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E3E0D8] bg-[#F7F6F2] p-5 text-sm leading-6 text-[#6B7280]">
      {children}
    </div>
  );
}

function SessionDetailLines({
  details,
  fallback,
}: {
  details?: string | null;
  fallback: string;
}) {
  const text = String(details ?? "").trim();
  const sections = text
    ? (text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(
            /^(Purpose|Workout|Intensity|Coach note|Adaptation):\s*(.+)$/i,
          );
          return match ? { label: match[1], body: match[2].trim() } : null;
        })
        .filter(Boolean) as Array<{ label: string; body: string }>)
    : [];

  if (!sections.length) {
    return (
      <p className="mt-2 text-sm leading-5 text-[#6B7280]">
        {text || fallback}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {sections.slice(0, 4).map((section) => (
        <p key={section.label} className="text-[13px] leading-5 text-[#4B5563]">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">
            {section.label} ·{" "}
          </span>
          {section.body}
        </p>
      ))}
    </div>
  );
}

export default function CoachingPointsDashboard({
  sessions,
  completedSessions,
  stravaActivities,
  stravaConnected,
  raceDate,
}: Props) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const priorWeekStart = subDays(weekStart, 7);
  const priorWeekEnd = subDays(weekEnd, 7);
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`;
  const countdown = raceCountdown(raceDate);

  const plannedThisWeek = sessions
    .filter((session) => {
      const date = safeParseDate(session.date);
      return date ? isWithinRange(date, weekStart, weekEnd) : false;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const completedThisWeek = completedSessions.filter((row) => {
    if (row.status === "skipped") return false;
    const date = safeParseDate(getCompletedDate(row));
    return date ? isWithinRange(date, weekStart, weekEnd) : false;
  });

  const currentWeekActivities = stravaActivities.filter((activity) => {
    const date = getActivityDate(activity);
    return date ? isWithinRange(date, weekStart, weekEnd) : false;
  });

  const priorWeekActivities = stravaActivities.filter((activity) => {
    const date = getActivityDate(activity);
    return date ? isWithinRange(date, priorWeekStart, priorWeekEnd) : false;
  });

  const plannedMinutes = plannedThisWeek.reduce(
    (total, session) => total + sessionDurationMinutes(session),
    0,
  );
  const stravaMinutes = currentWeekActivities.reduce(
    (total, activity) =>
      total + Math.max(0, Number(activity.moving_time ?? 0) / 60),
    0,
  );
  const actualMinutes =
    stravaMinutes > 0
      ? stravaMinutes
      : completedThisWeek.reduce(
          (total, row) =>
            total +
            (typeof row.duration === "number"
              ? row.duration
              : estimateDurationFromTitle(getCompletedTitle(row))),
          0,
        );
  const priorMinutes = priorWeekActivities.reduce(
    (total, activity) =>
      total + Math.max(0, Number(activity.moving_time ?? 0) / 60),
    0,
  );
  const deltaMinutes = Math.round(actualMinutes - priorMinutes);

  const plannedPoints = plannedThisWeek.reduce(
    (total, session) =>
      total +
      calculateSessionPoints({
        sport: session.sport,
        title: session.title,
        durationMinutes: sessionDurationMinutes(session),
      }),
    0,
  );
  const earnedPoints =
    completedThisWeek.length > 0
      ? completedThisWeek.reduce(
          (total, row) =>
            total +
            calculateSessionPoints({
              sport: row.sport,
              title: getCompletedTitle(row),
              durationMinutes:
                typeof row.duration === "number"
                  ? row.duration
                  : estimateDurationFromTitle(getCompletedTitle(row)),
            }),
          0,
        )
      : currentWeekActivities.reduce(
          (total, activity) =>
            total +
            calculateSessionPoints({
              sport: activity.sport_type,
              title: activity.name,
              durationMinutes: Math.max(
                0,
                Number(activity.moving_time ?? 0) / 60,
              ),
            }),
          0,
        );

  const pointsRemaining = Math.max(0, plannedPoints - earnedPoints);
  const pointsPct =
    plannedPoints > 0 ? Math.round((earnedPoints / plannedPoints) * 100) : 0;
  const completionPct =
    plannedThisWeek.length > 0
      ? Math.round((completedThisWeek.length / plannedThisWeek.length) * 100)
      : 0;
  const volumeScore =
    plannedMinutes > 0
      ? clamp((actualMinutes / plannedMinutes) * 100, 0, 110)
      : actualMinutes > 0
        ? 55
        : 0;
  const readiness = Math.round(
    clamp(
      completionPct * 0.42 +
        clamp(pointsPct, 0, 115) * 0.32 +
        volumeScore * 0.18 +
        (stravaConnected ? 8 : 0),
      0,
      95,
    ),
  );
  const readinessLabel =
    readiness >= 80
      ? "On track"
      : readiness >= 60
        ? "Building"
        : readiness >= 35
          ? "Needs consistency"
          : "Foundation";
  const deltaText =
    Math.abs(deltaMinutes) < 5
      ? "flat vs last week"
      : `${deltaMinutes > 0 ? "+" : "−"}${formatMinutes(Math.abs(deltaMinutes))} vs last week`;

  const sportMinutes: Record<SportBucket, number> = {
    Swim: 0,
    Bike: 0,
    Run: 0,
    Strength: 0,
    Other: 0,
  };
  currentWeekActivities.forEach((activity) => {
    sportMinutes[normalizeSport(activity.sport_type)] += Math.max(
      0,
      Number(activity.moving_time ?? 0) / 60,
    );
  });
  if (!Object.values(sportMinutes).some((value) => value > 0)) {
    completedThisWeek.forEach((row) => {
      sportMinutes[normalizeSport(row.sport)] +=
        typeof row.duration === "number"
          ? row.duration
          : estimateDurationFromTitle(getCompletedTitle(row));
    });
  }

  const upcomingSessions = sessions
    .filter((session) => {
      const date = safeParseDate(session.date);
      return date
        ? isWithinRange(date, today, addDays(today, 10)) &&
            session.sport !== "Rest"
        : false;
    })
    .sort(
      (a, b) =>
        sessionPriority(b) - sessionPriority(a) ||
        String(a.date).localeCompare(String(b.date)),
    )
    .slice(0, 3);

  const missionText =
    plannedPoints > 0
      ? `${pointsRemaining} pts to go. Points reflect planned training value: longer, key, and race-specific sessions count more.`
      : "Complete your next planned session to start banking points.";

  const weeklyReview =
    plannedThisWeek.length > 0
      ? `This week is ${earnedPoints}/${plannedPoints} points with ${completedThisWeek.length}/${plannedThisWeek.length} sessions complete. ${missionText}`
      : "No planned sessions this week yet. Generate a plan to create a weekly points target.";

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#101114]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-[#E3E0D8] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563FF]">
              Coaching
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.07em] text-[#101114] sm:text-5xl">
              Training review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
              Action-first coaching for the week ahead. Do the work, bank the
              proof, and watch Race Readiness move.
            </p>
          </div>
          <div className="rounded-full border border-[#E3E0D8] bg-white px-4 py-2 text-sm text-[#6B7280]">
            {countdown !== null ? `${countdown} days to race` : weekLabel}
          </div>
        </header>

        <div className="mb-6">
          <StravaConnectBanner stravaConnected={stravaConnected} />
        </div>

        <section className="mb-6 overflow-hidden rounded-[30px] border border-[#E3E0D8] bg-white shadow-[0_24px_80px_rgba(16,17,20,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-[#101114] p-6 text-white sm:p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                Coach insight
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.07em] sm:text-4xl">
                {readiness >= 70
                  ? "Good build — keep the rhythm."
                  : "The next win is consistency."}
              </h2>
              <p className="mt-4 text-base leading-7 text-white/65">
                {weeklyReview}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-4 py-2 text-[13px] font-black text-[#101114]">
                  View adapted week
                </span>
                <span className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-bold text-white/75">
                  Ask coach
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563FF]">
                What moves readiness next
              </p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl bg-[#F7F6F2] p-4">
                  <p className="text-sm font-black text-[#101114]">
                    Complete the key session
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[#6B7280]">
                    Long, race-specific sessions carry more weight than filler
                    volume.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#EAF0FF] p-4">
                  <p className="text-sm font-black text-[#101114]">
                    Sync the proof
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[#46506A]">
                    Strava-confirmed work improves the accuracy of the next
                    coaching decision.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] bg-[#101114] p-6 text-white shadow-[0_24px_70px_rgba(16,17,20,0.14)] sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              This week
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight">
              Training value
            </h2>
            <div className="mt-8 flex items-end gap-3">
              <span className="text-6xl font-semibold tracking-tight">
                {earnedPoints}
              </span>
              <span className="pb-2 text-2xl font-semibold text-[#9CA3AF]">
                / {plannedPoints || 0} pts
              </span>
            </div>
            <div className="mt-6 h-3 rounded-full bg-white/20">
              <div
                className="h-3 rounded-full bg-white"
                style={{ width: `${Math.min(100, pointsPct)}%` }}
              />
            </div>
            <p className="mt-4 text-base font-semibold text-zinc-300">
              {pointsRemaining} pts to go
            </p>
          </div>

          <div className="rounded-[30px] border border-[#E3E0D8] bg-white p-6 shadow-[0_24px_80px_rgba(16,17,20,0.07)] sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              Race readiness
            </p>
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-[12px] border-[#C6F33C]">
                <div className="text-center">
                  <p className="text-5xl font-semibold tracking-tight">
                    {readiness}
                  </p>
                  <p className="text-lg font-semibold text-[#6B7280]">/100</p>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[#101114]">
                  {readinessLabel}
                </h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-[#4B5563]">
                  Target 80+ by race week. This reflects consistency, plan
                  adherence, key sessions, fatigue control, and Strava-confirmed
                  work.
                </p>
              </div>
            </div>
            <div className="mt-6 h-2 rounded-full bg-[#E9ECE8]">
              <div
                className="h-2 rounded-full bg-[#C6F33C]"
                style={{ width: `${readiness}%` }}
              />
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Points earned"
            value={`${earnedPoints}`}
            detail={
              plannedPoints > 0
                ? `${pointsRemaining} remaining this week`
                : "No target yet"
            }
          />
          <MetricTile
            label="Time trained"
            value={formatMinutes(actualMinutes)}
            detail={`${deltaText} · ${weekLabel}`}
          />
          <MetricTile
            label="Sessions complete"
            value={`${completedThisWeek.length}/${plannedThisWeek.length || 0}`}
            detail={
              plannedThisWeek.length > 0
                ? `${completionPct}% of this week`
                : "No planned sessions this week"
            }
          />
          <MetricTile
            label="Plan to date"
            value={`${completedSessions.length}`}
            detail={`${sessions.length} planned sessions total`}
          />
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-[#E3E0D8] bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#101114]">
                  Training mix
                </h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Time logged by sport this week.
                </p>
              </div>
              <span className="rounded-full bg-[#E9ECE8] px-3 py-1 text-xs font-medium text-[#4B5563]">
                {formatMinutes(actualMinutes)}
              </span>
            </div>
            <div className="space-y-4">
              {(["Bike", "Run", "Swim", "Strength", "Other"] as SportBucket[])
                .filter((sport) => sportMinutes[sport] > 0 || sport !== "Other")
                .map((sport) => {
                  const minutes = sportMinutes[sport];
                  const pct =
                    actualMinutes > 0
                      ? Math.max(2, Math.round((minutes / actualMinutes) * 100))
                      : 0;
                  return (
                    <div key={sport}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${sportDotClass(sport)}`}
                          />
                          <span className="font-medium text-[#25272D]">
                            {sport}
                          </span>
                        </div>
                        <span className="text-[#6B7280]">
                          {formatMinutes(minutes)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E9ECE8]">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{
                            width: `${pct}%`,
                            opacity: minutes > 0 ? 1 : 0.08,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#E3E0D8] bg-white p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold tracking-tight text-[#101114]">
                Weekly review
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                A plain-English read on points, consistency, and training
                volume.
              </p>
            </div>
            <p className="text-base leading-7 text-[#374151]">{weeklyReview}</p>
          </div>
        </section>

        <section className="mb-6 rounded-[28px] border border-[#E3E0D8] bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[#101114]">
                Up next
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Upcoming sessions and the points they are worth.
              </p>
            </div>
            <span className="text-sm text-[#9CA3AF]">Next 10 days</span>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {upcomingSessions.map((session) => {
                const points = calculateSessionPoints({
                  sport: session.sport,
                  title: session.title,
                  durationMinutes: sessionDurationMinutes(session),
                });
                return (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-[#E3E0D8] bg-white p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${sportDotClass(session.sport)}`}
                        />
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                          {session.sport}
                        </span>
                      </div>
                      <span className="text-xs text-[#9CA3AF]">
                        {getSessionDateLabel(session)}
                      </span>
                    </div>
                    <p className="text-base font-semibold leading-6 text-[#101114]">
                      {session.title}
                    </p>
                    <SessionDetailLines
                      details={session.details}
                      fallback={`${formatMinutes(sessionDurationMinutes(session))} planned`}
                    />
                    <p className="mt-4 text-sm font-semibold text-[#2563FF]">
                      +{points} pts
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyCard>
              No upcoming sessions found. Once your plan has sessions in the
              next 10 days, they will appear here.
            </EmptyCard>
          )}
        </section>

        <section className="rounded-[28px] border border-[#E3E0D8] bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[#101114]">
                Longer trend
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                A simple view of recent training load from completed work.
              </p>
            </div>
            <span className="rounded-full border border-[#E3E0D8] bg-white px-3 py-1.5 text-xs text-[#6B7280]">
              Last 30 days
            </span>
          </div>
          <FitnessPanel
            sessions={sessions}
            completedSessions={completedSessions as any}
            stravaActivities={stravaActivities}
            windowDays={30}
          />
        </section>
      </div>
    </main>
  );
}
