'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';
import { parseISO, startOfWeek, addDays, isWithinInterval, isBefore, isEqual } from 'date-fns';
import clsx from 'clsx';

type Props = {
  weeklySummary: WeeklySummary;
  viewMode: 'week' | 'plan';
};

function getMessage(pct: number, plannedSoFar: number) {
  if (plannedSoFar === 0) return 'No sessions planned yet for this week.';
  if (pct >= 90) return 'Excellent consistency — you’re executing the week really well.';
  if (pct >= 75) return 'Good week so far — keep the momentum going.';
  if (pct >= 60) return 'Decent consistency — a small push gets you back on track.';
  return 'Low consistency so far — consider simplifying the week and focus on one key win.';
}

function getBadgeClasses(pct: number) {
  if (pct >= 85) return 'bg-green-100 text-green-700';
  if (pct >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function CompliancePanel({ weeklySummary, viewMode }: Props) {
  const isPlan = viewMode === 'plan';

  // Keep plan mode for compatibility, but the redesigned dashboard will pass "week".
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6); // inclusive Sun

  const rawPlanned = weeklySummary.debug?.rawPlanned ?? [];

  const plannedThisWeek = rawPlanned.filter((s: any) => {
    try {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    } catch {
      return false;
    }
  });

  const plannedSoFar = plannedThisWeek.filter((s: any) => {
    try {
      const d = parseISO(s.date);
      return isBefore(d, today) || isEqual(d, today);
    } catch {
      return false;
    }
  }).length;

  // NOTE: weeklySummary.totalCompleted should be “this week completed” if your summary is WTD.
  // If it ever isn't, this will still behave reasonably (we'll fix summary logic next pass).
  const completedSoFar = weeklySummary.totalCompleted ?? 0;

  const weekPct =
    plannedSoFar > 0 ? Math.round((completedSoFar / plannedSoFar) * 100) : 0;

  // Plan-to-date fallback (kept for compatibility)
  const planPlanned = weeklySummary.planToDate?.planned ?? 0;
  const planCompleted = weeklySummary.planToDate?.completed ?? 0;
  const planPct = weeklySummary.planToDate?.adherence ?? 0;
  const trend = weeklySummary.trend;

  const message = isPlan ? getMessage(planPct, planPlanned) : getMessage(weekPct, plannedSoFar);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Consistency</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isPlan ? 'Overall consistency since plan start.' : 'How reliably you’re executing this week.'}
          </p>
        </div>

        <div
          className={clsx(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
            getBadgeClasses(isPlan ? planPct : weekPct)
          )}
        >
          {isPlan ? `${planPct}%` : `${weekPct}%`}
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-700">{message}</p>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        {isPlan ? (
          <>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Completed</p>
              <p className="mt-1 font-semibold text-gray-900">
                {planCompleted}/{planPlanned}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Trend</p>
              <p className="mt-1 font-semibold text-gray-900">
                {trend !== undefined ? (
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                      trend > 0
                        ? 'bg-green-100 text-green-700'
                        : trend < 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {trend > 0 ? '+' : ''}
                    {trend}%
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Completed so far</p>
              <p className="mt-1 font-semibold text-gray-900">
                {completedSoFar}/{plannedSoFar}
              </p>
              <p className="mt-1 text-xs text-gray-400">Counts planned up to today</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Remaining this week</p>
              <p className="mt-1 font-semibold text-gray-900">
                {Math.max(0, plannedThisWeek.length - completedSoFar)}
              </p>
              <p className="mt-1 text-xs text-gray-400">Mon–Sun window</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 text-[11px] text-gray-400">
        {isPlan
          ? 'Tracks all sessions assigned since your plan started.'
          : 'Tracks sessions planned this week. We’ll upgrade this to time-based consistency next.'}
      </div>
    </div>
  );
}
