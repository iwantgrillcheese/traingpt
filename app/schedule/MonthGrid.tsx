"use client";

import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo } from "react";
import DayCell from "./DayCell";
import type { MergedSession } from "@/utils/mergeSessionWithStrava";
import type { StravaActivity } from "@/types/strava";
import type { CompletedSession } from "@/types/session";

type MonthGridProps = {
  currentMonth: Date;
  sessionsByDate: Record<string, MergedSession[]>;
  completedSessions: CompletedSession[];
  stravaByDate: Record<string, StravaActivity[]>;
  onSessionClick?: (session: MergedSession) => void;
  onStravaActivityClick?: (activity: StravaActivity) => void;
  onAddSessionClick?: (date: Date) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  completedSessions,
  stravaByDate,
  onSessionClick,
  onStravaActivityClick,
  onAddSessionClick,
}: MonthGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const result: Date[] = [];
    let cursor = start;

    while (cursor <= end) {
      result.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return result;
  }, [currentMonth]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#E3E0D8] bg-white shadow-[0_18px_60px_rgba(16,17,20,0.05)]">
      <div className="grid grid-cols-7 border-b border-[#E3E0D8] bg-[#F7F6F2]">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#9CA3AF]"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dayKey = format(date, "yyyy-MM-dd");
          return (
            <DayCell
              key={dayKey}
              date={date}
              sessions={sessionsByDate[dayKey] ?? []}
              isOutside={!isSameMonth(date, currentMonth)}
              completedSessions={completedSessions}
              extraActivities={stravaByDate[dayKey] ?? []}
              onSessionClick={onSessionClick}
              onStravaActivityClick={onStravaActivityClick}
              onAddSessionClick={onAddSessionClick}
            />
          );
        })}
      </div>
    </section>
  );
}
