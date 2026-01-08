'use client';

import React, { useMemo } from 'react';
import { startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from 'date-fns';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  currentMonth: Date;
  sessionsByDate: Record<string, MergedSession[]>;
  completedSessions: CompletedSession[];
  stravaByDate: Record<string, StravaActivity[]>;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function CalendarSummaryPanel({
  currentMonth,
  sessionsByDate,
  completedSessions,
}: Props) {
  const range = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return { start, end };
  }, [currentMonth]);

  const planned = useMemo(() => {
    let count = 0;
    for (const dateStr of Object.keys(sessionsByDate)) {
      const d = parseISO(dateStr);
      if (!isWithinInterval(d, range)) continue;
      count += sessionsByDate[dateStr]?.length ?? 0;
    }
    return count;
  }, [sessionsByDate, range]);

  const completed = useMemo(() => {
    return completedSessions.filter((c) => {
      const d = parseISO(c.date);
      return isWithinInterval(d, range);
    }).length;
  }, [completedSessions, range]);

  const adherence = planned > 0 ? Math.round((completed / planned) * 100) : 0;

  return (
    <div className="sticky top-[72px] space-y-4">
      <div className="px-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Summary
        </div>
        <div className="mt-1 text-sm font-semibold tracking-tight text-zinc-950">
          {format(currentMonth, 'MMMM yyyy')}
        </div>
      </div>

      <Card title="Compliance">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-zinc-950">
              {adherence}%
            </div>
            <div className="mt-1 text-[12px] text-zinc-500">
              {completed} completed · {planned} planned
            </div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900"
            style={{ width: `${Math.min(100, Math.max(0, adherence))}%` }}
          />
        </div>
      </Card>

      <Card title="Guidance">
        <div className="text-[12px] leading-relaxed text-zinc-500">
          Drag sessions to protect consistency. Don’t chase perfection—chase repeatability.
        </div>
      </Card>
    </div>
  );
}
