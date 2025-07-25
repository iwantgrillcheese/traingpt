'use client';

import { useState } from 'react';
import type { WeeklySummary } from '@/utils/getWeeklySummary';
import { parseISO, isBefore, isEqual } from 'date-fns';
import clsx from 'clsx';

type Props = {
  weeklySummary: WeeklySummary;
};

function getComplianceMessage(planned: number, completed: number): string {
  if (planned === 0) return 'No sessions were planned this week.';
  if (completed === 0) return 'You didn’t complete any sessions this week.';
  const ratio = completed / planned;
  if (ratio >= 1) return 'Perfect week — you nailed everything!';
  if (ratio >= 0.8) return 'Nice work — high adherence.';
  if (ratio >= 0.6) return 'Decent adherence — but some gaps to close.';
  return 'Low adherence — consider adjusting your plan.';
}

export default function CompliancePanel({ weeklySummary }: Props) {
  const [mode, setMode] = useState<'week' | 'plan'>('week');

  const today = new Date();
  const rawPlanned = weeklySummary.debug?.rawPlanned ?? [];

  const plannedThisWeek = rawPlanned.filter((s) => {
    const d = parseISO(s.date);
    return isBefore(d, today) || isEqual(d, today);
  }).length;

  const completedThisWeek = weeklySummary.totalCompleted;

  const { planned, completed, adherence } = weeklySummary.planToDate;
  const trend = weeklySummary.trend;

  const weekPct = plannedThisWeek > 0 ? Math.round((completedThisWeek / plannedThisWeek) * 100) : 0;
  const planPct = adherence;

  const message =
    mode === 'week'
      ? getComplianceMessage(plannedThisWeek, completedThisWeek)
      : planPct >= 85
      ? 'You’re crushing your training so far.'
      : planPct >= 60
      ? 'Decent long-term consistency — keep pushing.'
      : 'Adherence is low overall — time to reset and refocus.';

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">📋 Training Compliance</h2>

      {/* Toggle */}
      <div className="mb-4 flex gap-2">
        {['week', 'plan'].map((val) => (
          <button
            key={val}
            onClick={() => setMode(val as 'week' | 'plan')}
            className={clsx(
              'text-sm px-3 py-1 rounded-full border',
              mode === val
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            )}
          >
            {val === 'week' ? 'Week-to-date' : 'Plan-to-date'}
          </button>
        ))}
      </div>

      {/* Message */}
      <p className="text-sm leading-relaxed text-gray-700">{message}</p>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-600">
        {mode === 'week' ? (
          <>
            <div>
              <span className="block font-medium text-gray-800">Completed</span>
              {completedThisWeek}/{plannedThisWeek} ({weekPct}%)
            </div>
            <div>
              <span className="block font-medium text-gray-800">Remaining</span>
              {Math.max(0, plannedThisWeek - completedThisWeek)}
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="block font-medium text-gray-800">Completed</span>
              {completed}/{planned} ({planPct}%)
            </div>
            <div>
              <span className="block font-medium text-gray-800">Trend</span>
              {trend !== undefined ? (
                <span
                  className={clsx(
                    'ml-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    trend > 0
                      ? 'bg-green-100 text-green-700'
                      : trend < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {trend > 0 ? '+' : ''}
                  {trend}%
                </span>
              ) : (
                '—'
              )}
            </div>
          </>
        )}
      </div>

      {/* Footnote */}
      <div className="mt-2 text-[11px] text-gray-400">
        {mode === 'week'
          ? 'Tracks sessions planned and completed this week.'
          : 'Tracks all sessions assigned since your plan started.'}
      </div>
    </div>
  );
}
