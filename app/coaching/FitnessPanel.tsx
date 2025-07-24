'use client';

import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { format, addWeeks, startOfWeek, isWithinInterval, parseISO } from 'date-fns';
import type { Session } from '@/types/session';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import type { StravaActivity } from '@/types/strava';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type FitnessPanelProps = {
  sessions: Session[];
  completedSessions: Session[];
  stravaActivities?: StravaActivity[];
};

export default function FitnessPanel({
  sessions,
  completedSessions,
  stravaActivities = [],
}: FitnessPanelProps) {
  const weeksBack = 4;

  const { weeklyVolume, fitnessScore, labels } = useMemo(() => {
    const result: number[] = [];
    const labels: string[] = [];

    const now = new Date();
    const baseStart = startOfWeek(addWeeks(now, -weeksBack + 1), { weekStartsOn: 1 });

    for (let i = 0; i < weeksBack; i++) {
      const start = addWeeks(baseStart, i);
      const end = addWeeks(start, 1);
      labels.push(format(start, 'MMM d'));

      const allSessions = [...sessions, ...completedSessions].filter((s) =>
        isWithinInterval(parseISO(s.date), { start, end })
      );

      const sessionMins = allSessions.reduce((sum, s) => {
        const duration =
          typeof s.duration === 'number' ? s.duration : estimateDurationFromTitle(s.title) ?? 0;
        return sum + duration;
      }, 0);

      const stravaMins = stravaActivities
        .filter((a) => isWithinInterval(parseISO(a.start_date), { start, end }))
        .reduce((sum, a) => sum + (a.moving_time ?? 0) / 60, 0);

      const totalHours = (sessionMins + stravaMins) / 60;
      result.push(Math.round(totalHours * 10) / 10); // round to 1 decimal
    }

    const fitnessScore = Math.round(
      (result.reduce((sum, x) => sum + x, 0) / weeksBack / 10) * 100
    );

    return { weeklyVolume: result, fitnessScore, labels };
  }, [sessions, completedSessions, stravaActivities]);

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

      <div className="mt-6 text-sm text-gray-700">
        Fitness Score: <span className="font-medium">{fitnessScore}/100</span>
      </div>
    </div>
  );
}
