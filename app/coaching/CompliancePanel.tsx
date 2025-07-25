'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';
import { parseISO, isBefore, isEqual } from 'date-fns';

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
  const rawCompleted = weeklySummary.debug?.rawCompleted ?? [];

  const plannedToDate = rawPlanned.filter((s) => {
    const d = parseISO(s.date);
    return isBefore(d, today) || isEqual(d, today);
  }).length;

  const completedToDate = rawCompleted.length;

  const message = getComplianceMessage(plannedToDate, completedToDate);
  const score = plannedToDate > 0 ? Math.round((completedToDate / plannedToDate) * 100) : 0;

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📋 Training Compliance</h2>
      <p className="mt-4 text-sm text-gray-700 leading-relaxed">{message}</p>
      <p className="mt-1 text-xs text-gray-500">
        Compliance Score: {score}%
      </p>
    </div>
  );
}
