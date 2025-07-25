'use client';

import type { WeeklySummary } from '@/utils/getWeeklySummary';
import { parseISO, isBefore, isEqual } from 'date-fns';

type Props = {
  weeklySummary: WeeklySummary;
};

function getSummaryText(planned: number, completed: number): string {
  if (planned === 0) {
    return 'No sessions planned — likely a rest or taper week.';
  }
  if (completed === 0) {
    return 'No sessions completed — time to bounce back.';
  }
  const ratio = completed / planned;
  if (ratio >= 1) return 'Crushed it — 100% completion! 🔥';
  if (ratio >= 0.8) return 'Strong consistency — great momentum.';
  if (ratio >= 0.6) return 'Solid week, but there’s room to improve.';
  return 'Tough week — life happens. Let’s reset. 💪';
}

export default function WeeklySummaryPanel({ weeklySummary }: Props) {
  const today = new Date();

  const rawPlanned = weeklySummary.debug?.rawPlanned ?? [];
  const rawCompleted = weeklySummary.debug?.rawCompleted ?? [];

  const plannedToDate = rawPlanned.filter((s) => {
    const d = parseISO(s.date);
    return isBefore(d, today) || isEqual(d, today);
  }).length;

  const completedToDate = rawCompleted.length;

  const summary = getSummaryText(plannedToDate, completedToDate);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">🧠 Weekly Summary</h2>
      <p className="mt-4 text-sm text-gray-700 leading-relaxed">{summary}</p>
      <p className="mt-2 text-sm text-gray-500">
        {completedToDate} of {plannedToDate} sessions completed so far this week
      </p>
    </div>
  );
}
