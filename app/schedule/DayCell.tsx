"use client";

import type { ReactNode } from "react";

import { useMemo } from "react";
import { format, isToday } from "date-fns";
import clsx from "clsx";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { MergedSession } from "@/utils/mergeSessionWithStrava";
import type { StravaActivity } from "@/types/strava";
import type { CompletedSession } from "@/types/session";

type Props = {
  date: Date;
  sessions: MergedSession[];
  isOutside: boolean;
  completedSessions: CompletedSession[];
  extraActivities?: StravaActivity[];
  onSessionClick?: (session: MergedSession) => void;
  onStravaActivityClick?: (activity: StravaActivity) => void;
  onAddSessionClick?: (date: Date) => void;
};

type SportKey = "swim" | "bike" | "run" | "strength" | "rest" | "other";

function normalizeSport(value?: string | null): SportKey {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("swim")) return "swim";
  if (v.includes("bike") || v.includes("ride") || v.includes("cycle"))
    return "bike";
  if (v.includes("run")) return "run";
  if (v.includes("strength") || v.includes("gym")) return "strength";
  if (v.includes("rest") || v.includes("off")) return "rest";
  return "other";
}

function cleanTitle(title?: string | null) {
  return String(title ?? "Untitled")
    .replace(/^\p{Extended_Pictographic}\s*/u, "")
    .replace(/^[\s—–-]+/, "")
    .replace(/^[\s:•·]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function conciseTitle(title: string, sport: SportKey) {
  const cleaned = cleanTitle(title);
  const sportLabel =
    sport === "bike"
      ? /^(bike|ride)[:\s—-]/i
      : new RegExp(`^${sport}[:\\s—-]`, "i");
  return cleaned.replace(sportLabel, "").trim() || cleaned;
}

function formatDurationMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  if (value < 60) return `${Math.round(value)}m`;
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatActivityDuration(seconds?: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0)
    return null;
  return formatDurationMinutes(seconds / 60);
}

function formatDistanceMeters(meters?: number | null) {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0)
    return null;
  if (meters >= 1609) return `${(meters / 1609.34).toFixed(1)} mi`;
  return `${Math.round(meters)} m`;
}

function detailPreview(details?: string | null) {
  const text = String(details ?? "")
    .replace(/Purpose:\s*/gi, "")
    .replace(/Workout:\s*/gi, "")
    .replace(/Intensity:\s*/gi, "")
    .replace(/Coach note:\s*/gi, "")
    .split(/\n|\./)
    .map((part) => part.trim())
    .find((part) => part.length > 16);

  if (!text) return null;
  return text.length > 72 ? `${text.slice(0, 69).trim()}…` : text;
}

function getCompletionStatus(
  session: MergedSession,
  completedSessions: CompletedSession[],
) {
  const match = completedSessions.find(
    (item) =>
      item.date === session.date && item.session_title === session.title,
  );
  if (!match) return null;
  return match.status === "skipped" ? "skipped" : "done";
}

function sportDotClass(sport: SportKey) {
  switch (sport) {
    case "swim":
      return "bg-[#0E8FA0]";
    case "bike":
      return "bg-[#FF6A00]";
    case "run":
      return "bg-[#101114]";
    case "strength":
      return "bg-[#7C3AED]";
    case "rest":
      return "bg-[#9CA3AF]";
    default:
      return "bg-[#9CA3AF]";
  }
}

function sportAccentClass(sport: SportKey) {
  switch (sport) {
    case "swim":
      return "border-l-[#0E8FA0]";
    case "bike":
      return "border-l-[#FF6A00]";
    case "run":
      return "border-l-[#101114]";
    case "strength":
      return "border-l-[#7C3AED]";
    default:
      return "border-l-[#9CA3AF]";
  }
}

function DraggableSession({
  session,
  children,
}: {
  session: MergedSession;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: session.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: isDragging ? 0.72 : 1,
      }}
      className={clsx("touch-none", isDragging && "relative z-20")}
    >
      {children}
    </div>
  );
}

function SessionCard({
  session,
  completedSessions,
  onClick,
}: {
  session: MergedSession;
  completedSessions: CompletedSession[];
  onClick?: (session: MergedSession) => void;
}) {
  const title = cleanTitle(session.title);
  const sport = normalizeSport(session.sport || title);
  const status = getCompletionStatus(session, completedSessions);
  const completed = Boolean(session.stravaActivity) || status === "done";
  const skipped = !session.stravaActivity && status === "skipped";
  const duration = session.stravaActivity
    ? formatActivityDuration(session.stravaActivity.moving_time)
    : formatDurationMinutes(session.duration ?? null);
  const distance = session.stravaActivity
    ? formatDistanceMeters(session.stravaActivity.distance)
    : null;
  const isRest = sport === "rest" || title.toLowerCase().includes("rest day");
  const preview = detailPreview((session as any).details ?? null);

  return (
    <DraggableSession session={session}>
      <button
        type="button"
        onClick={() => !isRest && onClick?.(session)}
        className={clsx(
          "group w-full rounded-2xl border border-[#E3E0D8] border-l-[3px] bg-white px-2.5 py-2 text-left shadow-[0_1px_0_rgba(16,17,20,0.03)] transition-colors hover:border-[#CFCBC1] hover:bg-[#FBFAF8]",
          sportAccentClass(sport),
          completed &&
            "border-[#D6D3CB] bg-[#F7F6F2] shadow-[0_8px_24px_rgba(16,17,20,0.06)] hover:border-[#CFCBC1] hover:bg-[#F7F6F2]",
          skipped && "opacity-50",
          isRest && "cursor-default border-l-[#E3E0D8] bg-[#F7F6F2]",
        )}
        title={session.title}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  completed ? "bg-[#101114]" : sportDotClass(sport),
                )}
              />
              <span
                className={clsx(
                  "text-[10px] font-medium uppercase tracking-[0.12em]",
                  completed ? "text-[#4B5563]" : "text-[#9CA3AF]",
                )}
              >
                {sport}
              </span>
            </div>
            <div className="line-clamp-2 text-[12px] font-semibold leading-snug text-[#101114]">
              {isRest
                ? "Rest day"
                : `${conciseTitle(title, sport)}${duration ? ` · ${duration}` : ""}`}
            </div>
            {preview && !isRest ? (
              <div className="mt-1 line-clamp-1 text-[11px] leading-snug text-[#6B7280]">
                {preview}
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#6B7280]">
              {distance ? <span>{distance}</span> : null}
              {session.stravaActivity ? (
                <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold text-[#475569]">
                  Strava synced
                </span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
            {completed ? (
              <span className="inline-flex items-center rounded-full bg-[#101114] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                Done
              </span>
            ) : null}
            {skipped ? <span>Skip</span> : null}
          </div>
        </div>
      </button>
    </DraggableSession>
  );
}

function StravaImportCard({
  activity,
  onClick,
}: {
  activity: StravaActivity;
  onClick?: (activity: StravaActivity) => void;
}) {
  const sport = normalizeSport(activity.sport_type);
  const duration = formatActivityDuration(activity.moving_time);
  const distance = formatDistanceMeters(activity.distance);

  return (
    <button
      type="button"
      onClick={() => onClick?.(activity)}
      className="w-full rounded-lg border border-[#E3E0D8] border-l-[3px] border-l-[#FF6A00] bg-white px-2.5 py-2 text-left transition-colors hover:border-[#CFCBC1] hover:bg-[#FBFAF8]"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9CA3AF]">
          Strava
        </span>
      </div>
      <div className="line-clamp-1 text-[12px] font-semibold text-[#101114]">
        {activity.name || sport}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#6B7280]">
        {duration ? <span>{duration}</span> : null}
        {distance ? <span>{distance}</span> : null}
      </div>
    </button>
  );
}

export default function DayCell({
  date,
  sessions,
  isOutside,
  onSessionClick,
  onStravaActivityClick,
  onAddSessionClick,
  completedSessions,
  extraActivities = [],
}: Props) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const today = isToday(date);

  const dayLabel = useMemo(
    () => ({ day: format(date, "d"), weekday: format(date, "EEE") }),
    [date],
  );

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "group flex min-h-[158px] flex-col border-r border-b border-[#E3E0D8] bg-white px-2.5 py-2.5 transition-colors",
        isOutside && "bg-[#F7F6F2] text-[#9CA3AF]",
        today && "bg-[#F7F6F2]",
        isOver && "bg-[#E9ECE8]",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className={clsx(
              "flex h-6 min-w-6 items-center justify-center rounded-full text-[13px] font-semibold",
              today
                ? "bg-[#101114] text-white"
                : isOutside
                  ? "text-[#9CA3AF]"
                  : "text-[#101114]",
            )}
          >
            {dayLabel.day}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9CA3AF]">
            {dayLabel.weekday}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            completedSessions={completedSessions}
            onClick={onSessionClick}
          />
        ))}

        {extraActivities.slice(0, 3).map((activity) => (
          <StravaImportCard
            key={String(activity.strava_id ?? activity.id)}
            activity={activity}
            onClick={onStravaActivityClick}
          />
        ))}

        <button
          type="button"
          onClick={() => onAddSessionClick?.(date)}
          className="mt-auto rounded-xl border border-dashed border-[#E3E0D8] bg-white/70 px-2 py-1.5 text-center text-[11px] font-bold text-[#9CA3AF] opacity-0 transition hover:border-[#CFCBC1] hover:text-[#101114] group-hover:opacity-100"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
