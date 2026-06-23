"use client";

import { useEffect, useMemo, useState } from "react";
import {
  endOfWeek,
  format,
  isBefore,
  isSameWeek,
  isToday,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import clsx from "clsx";
import AddSessionModalTP from "./AddSessionModalTP";
import MobileSessionModal from "./MobileSessionModalV2";
import { exportCalendarClient } from "@/utils/exportCalendarClient";
import type { CompletedSession } from "@/types/session";
import type { StravaActivity } from "@/types/strava";
import type { MergedSession } from "@/utils/mergeSessionWithStrava";

type Props = {
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  stravaActivities?: StravaActivity[];
  onSessionDeleted?: (sessionId: string) => void;
  weekPhase?: string | null;
  raceGoal?: string | null;
};

type DayGroup = ReturnType<typeof groupSessionsByDate>[number];

type WeekGroup = {
  key: string;
  start: Date;
  end: Date;
  days: DayGroup[];
  totalSessions: number;
  isCurrent: boolean;
  isPast: boolean;
};

function parseDate(value?: string | null) {
  if (!value) return new Date();

  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  } catch {
    return new Date();
  }
}

function dateKey(value?: string | null) {
  return format(parseDate(value), "yyyy-MM-dd");
}

function normalizeSport(value?: string | null) {
  const v = String(value ?? "").toLowerCase();

  if (v.includes("swim")) return "Swim";
  if (v.includes("bike") || v.includes("ride")) return "Bike";
  if (v.includes("run")) return "Run";
  if (v.includes("brick")) return "Brick";
  if (v.includes("strength")) return "Strength";
  if (v.includes("rest")) return "Rest";

  return "Session";
}

function cleanTitle(title?: string | null) {
  return String(title ?? "Untitled session")
    .replace(/^\p{Extended_Pictographic}\s*/u, "")
    .replace(/^[\s—–-]+/, "")
    .replace(/^[\s:•·]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;

  if (value < 60) return `${Math.round(value)} min`;

  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);

  return m ? `${h}h ${m}m` : `${h}h`;
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
  return text.length > 96 ? `${text.slice(0, 93).trim()}…` : text;
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

function getSessionStatus(
  session: MergedSession,
  completedSessions: CompletedSession[],
) {
  const manualStatus = getCompletionStatus(session, completedSessions);

  if (manualStatus === "skipped") return "skipped";
  if (manualStatus === "done" || session.stravaActivity) return "done";

  const sessionDay = startOfDay(parseDate(session.date));
  const today = startOfDay(new Date());

  if (isBefore(sessionDay, today)) return "missed";

  return "planned";
}

function statusLabel(status: ReturnType<typeof getSessionStatus>) {
  if (status === "done") return "Done";
  if (status === "skipped") return "Skipped";
  if (status === "missed") return "Past";
  return "Planned";
}

function statusClass(status: ReturnType<typeof getSessionStatus>) {
  if (status === "done") return "bg-[#2563FF] text-white";
  if (status === "skipped") return "bg-[#EAF0FF] text-[#6B7280]";
  if (status === "missed")
    return "bg-white text-[#9CA3AF] ring-1 ring-inset ring-[#E3E0D8]";
  return "bg-white text-[#4B5563] ring-1 ring-inset ring-[#E3E0D8]";
}

function groupSessionsByDate(sessions: MergedSession[]) {
  const grouped = new Map<string, MergedSession[]>();

  sessions.forEach((session) => {
    const key = dateKey(session.date);
    const existing = grouped.get(key) ?? [];
    existing.push(session);
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => parseDate(a).getTime() - parseDate(b).getTime())
    .map(([key, items]) => ({
      key,
      date: parseDate(key),
      sessions: items.slice().sort((a, b) => {
        const aSport = normalizeSport(a.sport);
        const bSport = normalizeSport(b.sport);
        return aSport.localeCompare(bSport);
      }),
    }));
}

function groupDaysByWeek(groups: DayGroup[]): WeekGroup[] {
  const today = startOfDay(new Date());
  const grouped = new Map<string, Omit<WeekGroup, "totalSessions">>();

  groups.forEach((group) => {
    const start = startOfWeek(group.date, { weekStartsOn: 1 });
    const end = endOfWeek(group.date, { weekStartsOn: 1 });
    const key = format(start, "yyyy-MM-dd");
    const existing = grouped.get(key);

    if (existing) {
      existing.days.push(group);
      return;
    }

    grouped.set(key, {
      key,
      start,
      end,
      days: [group],
      isCurrent: isSameWeek(group.date, today, { weekStartsOn: 1 }),
      isPast: isBefore(end, today),
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((week) => ({
      ...week,
      totalSessions: week.days.reduce(
        (count, day) => count + day.sessions.length,
        0,
      ),
    }));
}

function getPlanRangeLabel(groups: ReturnType<typeof groupSessionsByDate>) {
  if (!groups.length) return "No sessions yet";

  const first = groups[0].date;
  const last = groups[groups.length - 1].date;

  if (format(first, "yyyy") !== format(last, "yyyy")) {
    return `${format(first, "MMM d, yyyy")} – ${format(last, "MMM d, yyyy")}`;
  }

  if (format(first, "MMM") !== format(last, "MMM")) {
    return `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
  }

  return `${format(first, "MMM d")} – ${format(last, "d, yyyy")}`;
}

function weekRangeLabel(week: WeekGroup) {
  if (week.isCurrent) return "This week";

  if (format(week.start, "MMM") === format(week.end, "MMM")) {
    return `${format(week.start, "MMM d")}–${format(week.end, "d")}`;
  }

  return `${format(week.start, "MMM d")}–${format(week.end, "MMM d")}`;
}

function sessionDetails(session: MergedSession) {
  return (session as MergedSession & { details?: string | null }).details ?? null;
}

export default function MobileCalendarView({
  sessions,
  completedSessions,
  onSessionDeleted,
  weekPhase,
  raceGoal,
}: Props) {
  const [localSessions, setLocalSessions] = useState<MergedSession[]>(sessions);
  const [localCompleted, setLocalCompleted] =
    useState<CompletedSession[]>(completedSessions);
  const [selectedSession, setSelectedSession] = useState<MergedSession | null>(
    null,
  );
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedWeekKeys, setExpandedWeekKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => setLocalSessions(sessions), [sessions]);
  useEffect(() => setLocalCompleted(completedSessions), [completedSessions]);

  const groups = useMemo(
    () => groupSessionsByDate(localSessions),
    [localSessions],
  );

  const weekGroups = useMemo(() => groupDaysByWeek(groups), [groups]);

  useEffect(() => {
    setExpandedWeekKeys((prev) => {
      const next = new Set(prev);
      weekGroups.forEach((week) => {
        if (!week.isPast) next.add(week.key);
      });
      return next;
    });
  }, [weekGroups]);

  const completion = useMemo(() => {
    const done = localSessions.filter(
      (session) => getSessionStatus(session, localCompleted) === "done",
    ).length;

    return {
      done,
      total: localSessions.length,
    };
  }, [localSessions, localCompleted]);

  const nextSession = useMemo(() => {
    const today = startOfDay(new Date());

    return (
      localSessions
        .filter((session) => startOfDay(parseDate(session.date)) >= today)
        .sort(
          (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime(),
        )[0] ?? null
    );
  }, [localSessions]);

  const handleCalendarExport = async () => {
    try {
      setExporting(true);
      await exportCalendarClient();
    } finally {
      setExporting(false);
    }
  };

  const handleSessionDeleted = (sessionId: string) => {
    setLocalSessions((prev) =>
      prev.filter((session) => session.id !== sessionId),
    );
    setSelectedSession(null);
    onSessionDeleted?.(sessionId);
  };

  const handleSessionUpdated = (updated: MergedSession) => {
    setLocalSessions((prev) =>
      prev.map((session) =>
        session.id === updated.id ? { ...session, ...updated } : session,
      ),
    );
    setSelectedSession((prev) =>
      prev?.id === updated.id ? { ...prev, ...updated } : prev,
    );
  };

  const togglePastWeek = (weekKey: string) => {
    setExpandedWeekKeys((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

  return (
    <main className="min-h-[100dvh] bg-[#F7F6F2] text-[#101114]">
      <header className="sticky top-0 z-20 border-b border-[#E3E0D8]/80 bg-[#F7F6F2]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-xl sm:px-5 sm:pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-black tracking-[-0.07em] text-[#101114] sm:text-[30px]">
              Schedule
            </h1>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#6B7280] sm:text-[13px]">
              {getPlanRangeLabel(groups)}
              {weekPhase ? ` · ${weekPhase}` : ""}
              {completion.total
                ? ` · ${completion.done}/${completion.total} complete`
                : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCalendarExport}
              disabled={exporting}
              className="min-h-10 rounded-full border border-[#E3E0D8] bg-white px-3 py-2 text-[12px] font-semibold text-[#4B5563] shadow-sm active:scale-[0.99] disabled:opacity-60"
            >
              {exporting ? "Sharing…" : "Export"}
            </button>
            <button
              type="button"
              onClick={() => setAddSessionDate(new Date())}
              className="min-h-10 rounded-full bg-[#2563FF] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_30px_rgba(37,99,255,0.22)] active:scale-[0.99]"
            >
              + Add
            </button>
          </div>
        </div>

        {nextSession ? (
          <button
            type="button"
            onClick={() => setSelectedSession(nextSession)}
            className="mt-3 block w-full rounded-[1.5rem] border border-[#D7DDFF] bg-[#EAF0FF] px-4 py-3 text-left shadow-[0_12px_32px_rgba(37,99,255,0.10)] active:scale-[0.997] sm:mt-4 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Next up
                </div>
                <div className="mt-1 line-clamp-2 text-[16px] font-black leading-5 tracking-[-0.03em] text-[#101114]">
                  {`${cleanTitle(nextSession.title)}${formatMinutes(nextSession.duration ?? null) ? ` · ${formatMinutes(nextSession.duration ?? null)}` : ""}`}
                </div>
                <div className="mt-1 text-[12px] text-[#6B7280]">
                  {format(parseDate(nextSession.date), "EEE, MMM d")} ·{" "}
                  {normalizeSport(nextSession.sport)}
                </div>
              </div>
              <span className="rounded-full bg-[#EAF0FF] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">
                Open
              </span>
            </div>
          </button>
        ) : null}
      </header>

      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-4 sm:px-5 sm:pt-5">
        {weekGroups.length ? (
          <div className="space-y-4 sm:space-y-5">
            {weekGroups.map((week) => {
              const isExpanded = expandedWeekKeys.has(week.key);
              const canCollapse = week.isPast;

              return (
                <section
                  key={week.key}
                  className="scroll-mt-32 rounded-[1.8rem] border border-[#E3E0D8]/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-4"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      if (canCollapse) togglePastWeek(week.key);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-between gap-3 rounded-[1.35rem] px-2 py-1.5 text-left",
                      canCollapse && "active:scale-[0.997]",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[18px] font-black tracking-[-0.045em] text-[#101114] sm:text-[20px]">
                          {weekRangeLabel(week)}
                        </h2>
                        {week.isCurrent ? (
                          <span className="rounded-full bg-[#2563FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[#6B7280] sm:text-[13px]">
                        {week.totalSessions} {week.totalSessions === 1 ? "session" : "sessions"}
                        {week.isPast ? " · past week" : ""}
                      </p>
                    </div>

                    {canCollapse ? (
                      <span className="shrink-0 rounded-full border border-[#E3E0D8] bg-[#F7F6F2] px-3 py-1.5 text-[12px] font-semibold text-[#4B5563]">
                        {isExpanded ? "Hide" : "Show"}
                      </span>
                    ) : null}
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 space-y-5">
                      {week.days.map((group) => {
                        const today = isToday(group.date);

                        return (
                          <section key={group.key} className="space-y-3">
                            <div className="flex items-end justify-between gap-3 px-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-[16px] font-semibold tracking-[-0.035em] text-[#101114] sm:text-[18px]">
                                    {today ? "Today" : format(group.date, "EEEE")}
                                  </h3>
                                  {today ? (
                                    <span className="rounded-full bg-[#2563FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                                      Today
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-[12px] text-[#6B7280] sm:text-[13px]">
                                  {format(group.date, "MMMM d")}
                                  {raceGoal ? ` · ${raceGoal}` : ""}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setAddSessionDate(group.date)}
                                className="min-h-9 rounded-full border border-[#E3E0D8] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#4B5563]"
                              >
                                Add
                              </button>
                            </div>

                            <div className="space-y-2">
                              {group.sessions.map((session) => {
                                const status = getSessionStatus(
                                  session,
                                  localCompleted,
                                );
                                const isDone = status === "done";
                                const actualMinutes = session.stravaActivity
                                  ?.moving_time
                                  ? Math.round(
                                      Number(
                                        session.stravaActivity.moving_time,
                                      ) / 60,
                                    )
                                  : null;
                                const duration = formatMinutes(
                                  actualMinutes ?? session.duration ?? null,
                                );
                                const sport = normalizeSport(session.sport);
                                const preview = detailPreview(
                                  sessionDetails(session),
                                );

                                return (
                                  <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => setSelectedSession(session)}
                                    className={clsx(
                                      "block w-full rounded-[1.35rem] border p-3.5 text-left shadow-[0_6px_20px_rgba(16,17,20,0.04)] active:scale-[0.997] sm:rounded-2xl sm:p-4",
                                      isDone
                                        ? "border-[#BBD1FF] bg-[#F7FAFF] shadow-[0_12px_30px_rgba(37,99,255,0.10)]"
                                        : "border-[#E3E0D8] bg-white",
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 text-[12px] font-medium text-[#6B7280]">
                                          <span
                                            className={clsx(
                                              "h-2 w-2 rounded-full",
                                              isDone ? "bg-[#2563FF]" : "bg-[#2563FF]",
                                            )}
                                          />
                                          <span>{sport}</span>
                                          {duration ? (
                                            <span className="text-[#CFCBC1]">
                                              •
                                            </span>
                                          ) : null}
                                          {duration ? <span>{duration}</span> : null}
                                        </div>

                                        <div className="mt-1.5 line-clamp-2 text-[15px] font-black leading-5 tracking-[-0.03em] text-[#101114] sm:text-[16px]">
                                          {cleanTitle(session.title)}
                                        </div>

                                        {preview ? (
                                          <div className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-[#6B7280] sm:text-[13px]">
                                            {preview}
                                          </div>
                                        ) : null}

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {isDone ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563FF] px-2.5 py-1 text-[11px] font-black text-white">
                                              <span aria-hidden="true">✓</span>
                                              Complete
                                            </span>
                                          ) : null}
                                          {session.stravaActivity ? (
                                            <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2563FF] ring-1 ring-inset ring-[#BBD1FF]">
                                              Strava synced
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>

                                      <span
                                        className={clsx(
                                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                          statusClass(status),
                                        )}
                                      >
                                        {statusLabel(status)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#E3E0D8] bg-white px-5 py-12 text-center">
            <div className="text-[17px] font-semibold tracking-[-0.02em] text-[#101114]">
              No sessions yet
            </div>
            <div className="mx-auto mt-2 max-w-[260px] text-[13px] leading-5 text-[#6B7280]">
              Generate a plan or add your first workout manually.
            </div>
            <button
              type="button"
              onClick={() => setAddSessionDate(new Date())}
              className="mt-5 rounded-full bg-[#2563FF] px-4 py-2.5 text-[13px] font-black text-white"
            >
              Add session
            </button>
          </div>
        )}
      </div>

      <MobileSessionModal
        session={selectedSession}
        stravaActivity={selectedSession?.stravaActivity}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        completedSessions={localCompleted}
        onCompletedUpdate={setLocalCompleted}
        onSessionDeleted={handleSessionDeleted}
        onSessionUpdated={handleSessionUpdated}
        weekPhase={weekPhase}
        raceGoal={raceGoal}
      />

      <AddSessionModalTP
        open={!!addSessionDate}
        date={addSessionDate ?? new Date()}
        onClose={() => setAddSessionDate(null)}
        onAdded={(row: MergedSession) => {
          setLocalSessions((prev) => [...prev, row]);
          setAddSessionDate(null);
        }}
      />
    </main>
  );
}
