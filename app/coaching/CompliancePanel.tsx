'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';

type Props = {
  summary: WeeklySummary;
};

export default function CompliancePanel({ summary }: Props) {
  const { totalPlanned, totalCompleted, adherence } = summary;

  const message =
    totalPlanned === 0
      ? 'No sessions were planned this week.'
      : `You completed ${totalCompleted} of ${totalPlanned} planned sessions.`;

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📋 Training Compliance</h2>

      <p className="mt-4 text-sm text-gray-700">{message}</p>

      <p className="mt-2 text-sm text-gray-700">
        Compliance Score: <span className="font-medium">{adherence}%</span>
      </p>
    </div>
  );
}
