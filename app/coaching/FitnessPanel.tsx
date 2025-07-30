'use client';

import { useMemo } from 'react';
import {
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Chart as ChartJS,
  Tooltip,
  Filler,
  Legend,
  LineController,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  format,
  addWeeks,
  startOfWeek,
  isWithinInterval,
  parseISO,
} from 'date-fns';

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
  Legend,
  LineController
);

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
  const weeksBack = 12;

  const { labels, fitness, fatigue, form, fitnessScore } = useMemo(() => {
    const fitness: number[] = [];
    const fatigue: number[] = [];
    const form: number[] = [];
    const labels: string[] = [];

    const now = new Date();
    const baseStart = startOfWeek(addWeeks(now, -weeksBack + 1), { weekStartsOn: 1 });

    const rollingFitness: number[] = [];
    const rollingFatigue: number[] = [];

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

      const totalLoad = sessionMins + stravaMins;

      // Simulate CTL (42d), ATL (7d), and TSB (CTL - ATL)
      const ctl = i < 6 ? totalLoad : (rollingFitness.slice(-6).reduce((a, b) => a + b, 0) + totalLoad) / 7;
      const atl = i < 2 ? totalLoad : (rollingFatigue.slice(-2).reduce((a, b) => a + b, 0) + totalLoad) / 3;
      const tsb = ctl - atl;

      rollingFitness.push(ctl);
      rollingFatigue.push(atl);

      fitness.push(Math.round(ctl));
      fatigue.push(Math.round(atl));
      form.push(Math.round(tsb));
    }

    const avgLoad = fitness.reduce((sum, x) => sum + x, 0) / fitness.length;
    const fitnessScore = Math.round((avgLoad / 10) * 100); // arbitrary scaling

    return { labels, fitness, fatigue, form, fitnessScore };
  }, [sessions, completedSessions, stravaActivities]);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📈 Fitness Trends</h2>

      <div className="mt-4">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: 'Fitness',
                data: fitness,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                tension: 0.3,
                fill: true,
              },
              {
                label: 'Fatigue',
                data: fatigue,
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                tension: 0.3,
                fill: true,
              },
              {
                label: 'Form',
                data: form,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                tension: 0.3,
                fill: true,
              },
            ],
          }}
          options={{
            responsive: true,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#374151',
                  boxWidth: 12,
                  boxHeight: 12,
                  font: { size: 12 },
                },
              },
              tooltip: {
                mode: 'index' as const,
                intersect: false,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  color: '#6B7280',
                  stepSize: 10,
                },
              },
              x: {
                ticks: {
                  color: '#6B7280',
                },
              },
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
