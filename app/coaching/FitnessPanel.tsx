// app/components/FitnessPanel.tsx
'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { format, subWeeks } from 'date-fns';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type FitnessPanelProps = {
  weeklyVolume: number[];
  fitnessScore?: number;
};

export default function FitnessPanel({ weeklyVolume, fitnessScore }: FitnessPanelProps) {
  const labels = weeklyVolume.map((_, i) =>
    format(subWeeks(new Date(), weeklyVolume.length - 1 - i), 'MMM d')
  );

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📊 Fitness Trends</h2>

      <div className="mt-4">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: 'Weekly Volume (hrs)',
                data: weeklyVolume,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
              },
            ],
          }}
          options={{
            responsive: true,
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } },
            },
            plugins: {
              legend: { display: false },
            },
          }}
        />
      </div>

      {fitnessScore !== undefined && (
        <div className="mt-6 text-sm text-gray-700">
          Fitness Score: <span className="font-medium">{fitnessScore}/100</span>
        </div>
      )}
    </div>
  );
}
