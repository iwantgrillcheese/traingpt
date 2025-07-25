'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';

type Props = {
  weeklySummary: WeeklySummary;
};

function getComplianceMessage(adherence: number, totalPlanned: number): string {
  if (totalPlanned === 0) {
    return 'No sessions were planned this week.';
  }

  if (adherence >= 100) {
    return 'Perfect week — you nailed everything!';
  } else if (adherence >= 80) {
    return 'Nice work — high adherence.';
  } else if (adherence >= 60) {
    return 'Decent adherence — but some gaps to close.';
  } else if (adherence > 0) {
    return 'Low adherence — consider adjusting your plan.';
  } else {
    return 'You didn’t complete any sessions this week.';
  }
}

export default function CompliancePanel({ weeklySummary }: Props) {
  const { adherence, totalPlanned } = weeklySummary;
  const message = getComplianceMessage(adherence, totalPlanned);

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📋 Training Compliance</h2>
      <p className="mt-4 text-sm text-gray-700 leading-relaxed">{message}</p>
      <p className="mt-1 text-xs text-gray-500">Compliance Score: {adherence}%</p>
    </div>
  );
}
