// utils/getWeeklySummary.ts

import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  isBefore,
  isEqual,
  addDays,
} from 'date-fns';

export type WeeklySummary = {
  totalPlanned: number;
  totalCompleted: number;
  adherence: number;
  sportBreakdown: {
    sport: string;
    planned: number;
    completed: number;
  }[];
  planToDate: {
    planned: number;
    completed: number;
    adherence: number;
  };
  trend?: number;
  debug?: {
    plannedSessionsCount: number;
    completedSessionsCount: number;
    stravaCount: number;
    rawPlanned: Session[];
    rawCompleted: any[];
  };
};

type CompletedRow = {
  date?: string; // legacy
  session_date?: string;
  session_title?: string;
  title?: string;
  sport?: string | null;
  duration?: number | null; // minutes (optional)
  strava_id?: string | number | null;
};

const normalizeSportLabel = (input: string | null | undefined): string => {
  const sport = input?.toLowerCase();
  switch (sport) {
    case 'swim':
      return 'Swim';
    case 'bike':
    case 'ride':
    case 'virtualride':
      return 'Bike';
    case 'run':
      return 'Run';
    case 'strength':
      return 'Strength';
    default:
      return 'Other';
  }
};

function safeParseISO(s?: string | null): Date | null {
  if (!s) return null;
  try {
    return parseISO(s);
  } catch {
    return null;
  }
}

function getCompletedDate(row: CompletedRow): string | undefined {
  return row.session_date ?? row.date ?? undefined;
}

function getCompletedTitle(row: CompletedRow): string {
  return (row.session_title ?? row.title ?? '').toString();
}

function getSessionMinutesFromPlanned(s: Session): number {
  const raw = (s as any).duration;
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw);
  return estimateDurationFromTitle((s as any).title ?? '');
}

function getMinutesFromCompletedRow(row: CompletedRow): number {
  if (row.duration != null && Number.isFinite(Number(row.duration))) return Number(row.duration);
  return estimateDurationFromTitle(getCompletedTitle(row));
}

function getMinutesFromStrava(a: StravaActivity): number {
  const mt = (a as any).moving_time;
  if (mt != null && Number.isFinite(Number(mt))) return Number(mt) / 60;
  return 0;
}

export function getWeeklySummary(
  sessions: Session[],
  completedSessions: any[],
  stravaActivities: StravaActivity[] = []
): WeeklySummary {
  const now = new Date();
  const today = new Date();

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekEnd, -7);

  const inWindow = (dateStr?: string | null, start?: Date, end?: Date) => {
    const d = safeParseISO(dateStr ?? undefined);
    if (!d || !start || !end) return false;
    return isWithinInterval(d, { start, end });
  };

  // Planned sessions (THIS WEEK, up to today)
  const weeklyPlanned = (sessions ?? []).filter((s) => {
    const d = safeParseISO(s.date);
    if (!d) return false;
    const inWeek = isWithinInterval(d, { start: weekStart, end: weekEnd });
    const upToToday = isBefore(d, today) || isEqual(d, today);
    return inWeek && upToToday;
  });

  // Plan-to-date planned (up to now)
  const allPlanned = (sessions ?? []).filter((s) => {
    const d = safeParseISO(s.date);
    return d ? isBefore(d, now) || isEqual(d, now) : false;
  });

  // Normalize completed rows and filter weekly / all-to-date
  const completedRows: CompletedRow[] = (completedSessions ?? []) as CompletedRow[];

  const weeklyCompletedRows = completedRows.filter((r) =>
    inWindow(getCompletedDate(r), weekStart, weekEnd)
  );

  const completedAllRows = completedRows.filter((r) => {
    const d = safeParseISO(getCompletedDate(r));
    return d ? isBefore(d, now) || isEqual(d, now) : false;
  });

  // Strava in windows
  const stravaThisWeek = (stravaActivities ?? []).filter((a) =>
    inWindow((a as any).start_date, weekStart, weekEnd)
  );
  const stravaLastWeek = (stravaActivities ?? []).filter((a) =>
    inWindow((a as any).start_date, lastWeekStart, lastWeekEnd)
  );
  const stravaAllToDate = (stravaActivities ?? []).filter((a) => {
    const d = safeParseISO((a as any).start_date);
    return d ? isBefore(d, now) || isEqual(d, now) : false;
  });

  // ✅ Merge planned <-> strava (preferred source of truth for completion)
  // Note: merge uses local_date logic and duration similarity; it returns per-session stravaActivity.
  const mergedThisWeek = mergeSessionsWithStrava(weeklyPlanned, stravaThisWeek);
  const mergedAllToDate = mergeSessionsWithStrava(allPlanned, stravaAllToDate);
  const mergedLastWeek = mergeSessionsWithStrava(
    (sessions ?? []).filter((s) => {
      const d = safeParseISO(s.date);
      return d ? isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd }) : false;
    }),
    stravaLastWeek
  );

  // Weekly completion:
  // - if Strava exists, completed = number of planned sessions with a match
  // - else fallback to completed_sessions rows
  const weeklyCompletedCount =
    stravaThisWeek.length > 0
      ? mergedThisWeek.merged.filter((s) => !!s.stravaActivity).length
      : weeklyCompletedRows.length;

  // Sport breakdown (counts)
  const sportMap = new Map<string, { planned: number; completed: number }>();

  weeklyPlanned.forEach((s) => {
    const key = normalizeSportLabel(s.sport);
    if (!sportMap.has(key)) sportMap.set(key, { planned: 0, completed: 0 });
    sportMap.get(key)!.planned += 1;
  });

  if (stravaThisWeek.length > 0) {
    mergedThisWeek.merged.forEach((s) => {
      if (!s.stravaActivity) return;
      const key = normalizeSportLabel(s.sport);
      if (!sportMap.has(key)) sportMap.set(key, { planned: 0, completed: 0 });
      sportMap.get(key)!.completed += 1;
    });
  } else {
    weeklyCompletedRows.forEach((r) => {
      const key = normalizeSportLabel(r.sport ?? undefined);
      if (!sportMap.has(key)) sportMap.set(key, { planned: 0, completed: 0 });
      sportMap.get(key)!.completed += 1;
    });
  }

  const sportBreakdown = Array.from(sportMap.entries())
    .map(([sport, counts]) => ({ sport, planned: counts.planned, completed: counts.completed }))
    .filter((x) => x.planned > 0 || x.completed > 0);

  // Minutes-based adherence
  const weeklyPlannedMinutes = weeklyPlanned.reduce((sum, s) => sum + getSessionMinutesFromPlanned(s), 0);

  // Completed minutes:
  // - if Strava exists, sum matched Strava activity moving_time (more accurate)
  // - else estimate from completed rows
  const weeklyCompletedMinutes =
    stravaThisWeek.length > 0
      ? mergedThisWeek.merged.reduce((sum, s) => sum + (s.stravaActivity ? getMinutesFromStrava(s.stravaActivity) : 0), 0)
      : weeklyCompletedRows.reduce((sum, r) => sum + getMinutesFromCompletedRow(r), 0);

  const adherence =
    weeklyPlannedMinutes > 0
      ? Math.round((weeklyCompletedMinutes / weeklyPlannedMinutes) * 100)
      : weeklyPlanned.length > 0
      ? Math.round((weeklyCompletedCount / weeklyPlanned.length) * 100)
      : 0;

  // Plan-to-date adherence (minutes-based)
  const allPlannedMinutes = allPlanned.reduce((sum, s) => sum + getSessionMinutesFromPlanned(s), 0);

  const planCompletedMinutes =
    stravaAllToDate.length > 0
      ? mergedAllToDate.merged.reduce((sum, s) => sum + (s.stravaActivity ? getMinutesFromStrava(s.stravaActivity) : 0), 0)
      : completedAllRows.reduce((sum, r) => sum + getMinutesFromCompletedRow(r), 0);

  const planAdherence =
    allPlannedMinutes > 0
      ? Math.round((planCompletedMinutes / allPlannedMinutes) * 100)
      : allPlanned.length > 0
      ? Math.round((completedAllRows.length / allPlanned.length) * 100)
      : 0;

  // Trend: this week adherence vs last week adherence (minutes-based)
  const lastWeekPlanned = mergedLastWeek.merged as any as Session[]; // only used for minutes calc below
  const lastWeekPlannedMinutes = (sessions ?? [])
    .filter((s) => {
      const d = safeParseISO(s.date);
      return d ? isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd }) : false;
    })
    .reduce((sum, s) => sum + getSessionMinutesFromPlanned(s), 0);

  const lastWeekCompletedMinutes =
    stravaLastWeek.length > 0
      ? mergedLastWeek.merged.reduce((sum, s) => sum + (s.stravaActivity ? getMinutesFromStrava(s.stravaActivity) : 0), 0)
      : completedRows
          .filter((r) => inWindow(getCompletedDate(r), lastWeekStart, lastWeekEnd))
          .reduce((sum, r) => sum + getMinutesFromCompletedRow(r), 0);

  const lastWeekAdherence =
    lastWeekPlannedMinutes > 0 ? Math.round((lastWeekCompletedMinutes / lastWeekPlannedMinutes) * 100) : 0;

  const trend = adherence - lastWeekAdherence;

  return {
    totalPlanned: weeklyPlanned.length,
    totalCompleted: weeklyCompletedCount,
    adherence: Math.max(0, Math.min(100, adherence)),
    sportBreakdown,
    planToDate: {
      planned: allPlanned.length,
      completed: completedAllRows.length,
      adherence: Math.max(0, Math.min(100, planAdherence)),
    },
    trend,
    debug: {
      plannedSessionsCount: weeklyPlanned.length,
      completedSessionsCount: weeklyCompletedCount,
      stravaCount: stravaThisWeek.length,
      rawPlanned: weeklyPlanned,
      // show whatever completion source was used
      rawCompleted: stravaThisWeek.length > 0 ? mergedThisWeek.merged.filter((s) => !!s.stravaActivity) : weeklyCompletedRows,
    },
  };
}
