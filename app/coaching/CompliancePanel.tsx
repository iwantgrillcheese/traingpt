'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';

type CompliancePanelProps = {
  summary: WeeklySummary;
};

export default function CompliancePanel({ summary }: CompliancePanelProps) {
  const { totalPlanned, totalCompleted, adherence } = summary;

  const feedback =
    totalPlanned === 0
      ? 'No sessions were planned this week — rest or taper phase?'
      : adherence >= 90
      ? 'Excellent consistency 👏'
      : adherence >= 70
      ? 'Solid effort — room to tighten up 💪'
      : "Let’s get back on track next week 🚀";

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📈 Training Compliance</h2>

      <p className="mt-4 text-sm text-gray-700">
        You completed <strong>{totalCompleted}</strong> of <strong>{totalPlanned}</strong> planned
        sessions this week.
      </p>

      <div className="mt-2 text-sm text-gray-700">
        Compliance Score: <span className="font-medium">{adherence}%</span>
      </div>

      <p className="mt-4 text-sm italic text-gray-500">{feedback}</p>
    </div>
  );
}
