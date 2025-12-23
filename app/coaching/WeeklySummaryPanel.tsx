'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';

const getColor = (adherence: number) => {
  if (adherence >= 85) return 'text-green-700';
  if (adherence >= 60) return 'text-yellow-700';
  return 'text-red-700';
};

type Props = {
  weeklySummary: WeeklySummary;
  viewMode: 'week' | 'plan';
};

export default function WeeklySummaryPanel({ weeklySummary, viewMode }: Props) {
  // We keep the prop for compatibility, but the redesigned dashboard will pass "week".
  const isPlan = viewMode === 'plan';

  const totalPlanned = isPlan ? weeklySummary.planToDate.planned : weeklySummary.totalPlanned;
  const totalCompleted = isPlan ? weeklySummary.planToDate.completed : weeklySummary.totalCompleted;
  const percentage = isPlan ? weeklySummary.planToDate.adherence : weeklySummary.adherence;

  const breakdown = weeklySummary.sportBreakdown ?? [];
  const hasBreakdown = breakdown.length > 0;

  const safePct = Number.isFinite(percentage) ? percentage : null;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isPlan ? 'Plan Summary' : 'Weekly Summary'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isPlan
              ? 'A quick snapshot of your overall consistency.'
              : 'A quick snapshot of how this week is going.'}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500">Adherence</p>
          <p className={`text-lg font-semibold ${safePct == null ? 'text-gray-400' : getColor(safePct)}`}>
            {safePct == null ? '—' : `${safePct}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Planned</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{totalPlanned}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{totalCompleted}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Remaining</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {Math.max(0, (totalPlanned ?? 0) - (totalCompleted ?? 0))}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-700">
        You’ve completed{' '}
        <span className="font-semibold">{totalCompleted}</span> of{' '}
        <span className="font-semibold">{totalPlanned}</span>{' '}
        {isPlan ? 'planned sessions so far.' : 'planned sessions this week.'}
      </p>

      {/* By sport */}
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900">By sport</p>

        {!hasBreakdown ? (
          <p className="mt-1 text-sm text-gray-500">No sport breakdown available yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {breakdown.map(({ sport, completed, planned }) => {
              const pct = planned > 0 ? Math.round((completed / planned) * 100) : null;
              return (
                <li key={sport} className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">{sport}</div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{completed}</span>/
                    {planned}
                    <span className="ml-2 text-xs text-gray-400">
                      {pct == null ? '—' : `${pct}%`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 text-[11px] text-gray-400">
        {isPlan
          ? 'Plan summary will improve as we tighten session matching and time-based tracking.'
          : 'This week is Monday–Sunday. Counts may include Strava uploads if they match planned sessions.'}
      </div>
    </div>
  );
}
