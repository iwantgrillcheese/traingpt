'use client';

import { WeeklySummary } from '@/utils/getWeeklySummary';

const getColor = (adherence: number) => {
  if (adherence >= 85) return 'text-green-600';
  if (adherence >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

type Props = {
  weeklySummary: WeeklySummary;
  viewMode: 'week' | 'plan';
};

export default function WeeklySummaryPanel({ weeklySummary, viewMode }: Props) {
  const total =
    viewMode === 'plan'
      ? weeklySummary.planToDate.planned
      : weeklySummary.totalPlanned;

  const done =
    viewMode === 'plan'
      ? weeklySummary.planToDate.completed
      : weeklySummary.totalCompleted;

  const percentage =
    viewMode === 'plan'
      ? weeklySummary.planToDate.adherence
      : weeklySummary.adherence;

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        📊 {viewMode === 'week' ? 'Weekly Summary' : 'Plan-to-Date Summary'}
      </h2>

      <div className="mt-4 text-sm text-gray-700">
        You completed <span className="font-semibold">{done}</span> out of{' '}
        <span className="font-semibold">{total}</span>{' '}
        {viewMode === 'week' ? 'planned sessions this week.' : 'total planned sessions so far.'}
      </div>

      <div className="mt-2 text-sm text-gray-700">
        Your {viewMode === 'week' ? 'weekly' : 'overall'} adherence is{' '}
        <span className={`font-semibold ${getColor(percentage)}`}>
          {isNaN(percentage) ? '—' : `${percentage}%`}
        </span>
      </div>

      {viewMode === 'week' && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-800">By sport:</p>
          <ul className="mt-1 space-y-1 text-sm text-gray-600">
            {weeklySummary.sportBreakdown.map(({ sport, completed, planned }) => (
              <li key={sport}>
                {sport}: {completed}/{planned}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
