'use client';

import { WeeklySummary } from '@/utils/getWeeklySummary';

const getColor = (adherence: number) => {
  if (adherence >= 85) return 'text-green-600';
  if (adherence >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

type Props = {
  summary: WeeklySummary;
};

export default function WeeklySummaryPanel({ summary }: Props) {
  const total = summary.totalPlanned;
  const done = summary.totalCompleted;
  const percentage = summary.adherence;

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📊 Weekly Summary</h2>

      <div className="mt-4 text-sm text-gray-700">
        You completed <span className="font-semibold">{done}</span> out of{' '}
        <span className="font-semibold">{total}</span> planned sessions this week.
      </div>

      <div className="mt-2 text-sm text-gray-700">
        Your weekly adherence is{' '}
        <span className={`font-semibold ${getColor(percentage)}`}>{percentage}%</span>
      </div>

      <ul className="mt-4 space-y-1 text-sm text-gray-600">
        {summary.sportBreakdown.map((s) => (
          <li key={s.sport}>
            {s.sport}: {s.completed}/{s.planned}
          </li>
        ))}
      </ul>
    </div>
  );
}
