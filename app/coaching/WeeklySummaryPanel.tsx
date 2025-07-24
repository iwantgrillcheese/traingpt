'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';

type Props = {
  weeklySummary: WeeklySummary;
};

function getSummaryText(adherence: number): string {
  if (adherence >= 100) {
    return "Crushed it! 100% completion. You nailed every session this week. 🔥";
  } else if (adherence >= 80) {
    return "Strong consistency — you completed most of your plan. Keep the momentum!";
  } else if (adherence >= 60) {
    return "Decent week, but there’s room to improve. Let’s refocus next week. 💪";
  } else if (adherence > 0) {
    return "Low adherence this week. Life happens — let’s reset and refocus. 🚀";
  } else {
    return "No sessions planned — likely a rest or taper week.";
  }
}

export default function WeeklySummaryPanel({ weeklySummary }: Props) {
  const { adherence } = weeklySummary;
  const summary = getSummaryText(adherence);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">🧠 Weekly Summary</h2>
      <p className="mt-4 text-sm text-gray-700">{summary}</p>
    </div>
  );
}
