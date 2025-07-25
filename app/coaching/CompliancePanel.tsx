'use client';

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
  const today = new Date();
  const rawPlanned = weeklySummary.debug?.rawPlanned ?? [];

  const plannedToDate = rawPlanned.filter((s) => {
    const d = parseISO(s.date);
    return isBefore(d, today) || isEqual(d, today);
  }).length;

  const completedToDate = weeklySummary.totalCompleted;
  const message = getComplianceMessage(plannedToDate, completedToDate);

  const { planned, completed, adherence } = weeklySummary.planToDate;
  const trend = weeklySummary.trend;

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📋 Training Compliance</h2>

      <p className="mt-4 text-sm text-gray-700 leading-relaxed">{message}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Week-to-date: {plannedToDate > 0 ? Math.round((completedToDate / plannedToDate) * 100) : 0}%
        </div>
        <div className="text-xs text-gray-500">
          Plan-to-date: {adherence}%
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
        <span>{completed}/{planned} sessions completed</span>
        {trend !== undefined && (
          <span
            className={clsx(
              'ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium',
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
        )}
      </div>

      <div className="mt-1 text-[10px] text-gray-400">
        Tracks all sessions assigned since your plan started
      </div>
    </div>
  );
}
