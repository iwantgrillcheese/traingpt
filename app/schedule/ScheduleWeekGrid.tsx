"use client";

import { addDays, format, isSameDay, parseISO } from "date-fns";
import clsx from "clsx";

import type { CompletedSession } from "@/types/session";
import type { MergedSession } from "@/utils/mergeSessionWithStrava";

type Props = {
  weekStart: Date;
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  selectedSessionId?: string | null;
  onSessionClick?: (session: MergedSession) => void;
};

type SportKey = "swim" | "bike" | "run" | "strength";

const SPORT_ROWS: Array<{ key: SportKey; label: string; dot: string; border: string }> = [
  { key: "swim", label: "Swim", dot: "bg-[#34B7F1]", border: "border-l-[#34B7F1]" },
  { key: "bike", label: "Bike", dot: "bg-[#9B7CF6]", border: "border-l-[#9B7CF6]" },
  { key: "run", label: "Run", dot: "bg-[#2FCB90]", border: "border-l-[#2FCB90]" },
  { key: "strength", label: "Strength", dot: "bg-[#C084FC]", border: "border-l-[#C084FC]" },
];

function sportKey(value?: string | null): SportKey | null {
  const sport = String(value ?? "").toLowerCase();
  if (sport.includes("swim")) return "swim";
  if (sport.includes("bike") || sport.includes("ride") || sport.includes("cycle")) return "bike";
  if (sport.includes("run")) return "run";
  if (sport.includes("strength") || sport.includes("gym")) return "strength";
  return null;
}

function cleanTitle(title?: string | null) {
  return String(title ?? "Untitled")
    .replace(/^\p{Extended_Pictographic}\s*/u, "")
    .replace(/^[\s—–-]+/, "")
    .replace(/^[\s:•·]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function conciseTitle(title: string, sport: SportKey | null) {
  const cleaned = cleanTitle(title);
  if (!sport) return cleaned;
  const sportLabel =
    sport === "bike"
      ? /^(bike|ride)[:\s—-]/i
      : new RegExp(`^${sport}[:\\s—-]`, "i");
  return cleaned.replace(sportLabel, "").trim() || cleaned;
}

function formatMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)}m`;
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function getCompletionStatus(session: MergedSession, completedSessions: CompletedSession[]) {
  if (session.stravaActivity) return "done";
  const match = completedSessions.find(
    (item) => item.date === session.date && item.session_title === session.title,
  );
  if (!match) return null;
  return match.status === "skipped" ? "skipped" : "done";
}

function isSameSession(a: MergedSession, id?: string | null) {
  return id ? String(a.id) === String(id) : false;
}

function rowStats(sessions: MergedSession[]) {
  const minutes = sessions.reduce((total, session) => {
    const value = typeof session.duration === "number" && Number.isFinite(session.duration) ? session.duration : 0;
    return total + value;
  }, 0);
  const count = sessions.length;
  const duration = formatMinutes(minutes) ?? "—";
  return `${duration} · ${count} ${count === 1 ? "session" : "sessions"}`;
}

function SessionBlock({
  session,
  completedSessions,
  selected,
  onClick,
}: {
  session: MergedSession;
  completedSessions: CompletedSession[];
  selected: boolean;
  onClick?: (session: MergedSession) => void;
}) {
  const sport = sportKey(session.sport || session.title);
  const row = SPORT_ROWS.find((item) => item.key === sport);
  const status = getCompletionStatus(session, completedSessions);
  const duration = session.stravaActivity
    ? formatMinutes(session.stravaActivity.moving_time / 60)
    : formatMinutes(session.duration ?? null);
  const isDone = status === "done";
  const isSkipped = status === "skipped";

  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={clsx(
        "flex min-h-[74px] w-full flex-col justify-center rounded-[15px] border border-[#E7E9F1] border-l-[5px] bg-white px-3 py-3 text-left shadow-[0_8px_18px_rgba(20,22,36,0.04)] transition hover:border-[#CFCBC1] hover:bg-[#FBFAF8]",
        row?.border ?? "border-l-[#9CA3AF]",
        selected && "border-[#B8B0FF] bg-gradient-to-b from-[#FBFAFF] to-white",
        isDone && "border-[#D6D3CB] bg-[#F7F6F2]",
        isSkipped && "opacity-50",
      )}
    >
      <div className="text-[13px] font-black leading-tight tracking-[-0.02em] text-[#11121A]">
        {conciseTitle(session.title, sport)}
      </div>
      <div className="mt-1 text-[12px] font-semibold leading-snug text-[#7A8094]">
        {duration ?? "Open details"}{isDone ? " · done" : isSkipped ? " · skipped" : ""}
      </div>
      {selected ? (
        <span className="mt-2 w-fit rounded-full bg-[#F1F0FF] px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#5D52E8]">
          Selected
        </span>
      ) : null}
    </button>
  );
}

export default function ScheduleWeekGrid({ weekStart, sessions, completedSessions, selectedSessionId, onSessionClick }: Props) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <section className="mb-7 overflow-auto rounded-[22px] border border-[#E7E9F1] bg-white shadow-[0_14px_34px_rgba(19,21,39,0.06)]">
      <div className="grid min-w-[1060px] grid-cols-[160px_repeat(7,minmax(120px,1fr))]">
        <div className="min-h-[54px] border-b border-r border-[#E7E9F1] bg-[#FAFBFF] px-3 py-4 text-[11px] font-black uppercase tracking-[0.09em] text-[#A3A9BC]">
          Sport
        </div>
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={clsx(
                "min-h-[54px] border-b border-r border-[#E7E9F1] bg-[#FAFBFF] px-3 py-4 text-[11px] font-black uppercase tracking-[0.09em] text-[#A3A9BC] last:border-r-0",
                today && "bg-[#F0EFFF] text-[#4F46E5]",
              )}
            >
              {format(day, "d EEE")}
            </div>
          );
        })}

        {SPORT_ROWS.map((row) => {
          const rowSessions = sessions.filter((session) => sportKey(session.sport || session.title) === row.key);
          return (
            <div key={row.key} className="contents">
              <div className="flex min-h-[112px] flex-col justify-center gap-2 border-b border-r border-[#E7E9F1] bg-[#FCFCFF] px-3 py-4">
                <div className="flex items-center gap-2 text-[16px] font-black tracking-[-0.03em] text-[#11121A]">
                  <span className={clsx("h-2.5 w-2.5 rounded-[4px]", row.dot)} />
                  {row.label}
                </div>
                <div className="text-[13px] font-semibold text-[#7A8195]">{rowStats(rowSessions)}</div>
              </div>

              {days.map((day) => {
                const daySessions = rowSessions.filter((session) => session.date && isSameDay(parseISO(session.date), day));
                return (
                  <div key={`${row.key}-${day.toISOString()}`} className="min-h-[112px] border-b border-r border-[#E7E9F1] bg-white p-2.5 last:border-r-0">
                    <div className="grid gap-2">
                      {daySessions.map((session) => (
                        <SessionBlock
                          key={session.id}
                          session={session}
                          completedSessions={completedSessions}
                          selected={isSameSession(session, selectedSessionId)}
                          onClick={onSessionClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
