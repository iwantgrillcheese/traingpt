'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';

type Props = {
  weeklySummary: WeeklySummary;
};

function getSummaryText(adherence: number, plannedSessionsCount: number): string {
  if (plannedSessionsCount === 0) {
    return 'No sessions planned — likely a rest or taper week.';
  }
  if (adherence >= 100) return 'Crushed it — 100% completion! 🔥';
  if (adherence >= 80) return 'Strong consistency — great momentum.';
  if (adherence >= 60) return 'Solid week, but there’s room to improve.';
  if (adherence > 0) return 'Tough week — life happens. Let’s reset. 💪';
  return 'No sessions completed — time to bounce back.';
}

export default function WeeklySummaryPanel({ weeklySummary }: Props) {
  const { adherence, debug } = weeklySummary;
  const summary = getSummaryText(adherence, debug?.plannedSessionsCount || 0);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">🧠 Weekly Summary</h2>
      <p className="mt-4 text-sm text-gray-700 leading-relaxed">{summary}</p>
    </div>
  );
}
