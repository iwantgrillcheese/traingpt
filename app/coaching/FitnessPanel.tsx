'use client';

import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import {
  format,
  subDays,
  eachDayOfInterval,
} from 'date-fns';
import type { Session } from '@/types/session';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';
import type { StravaActivity } from '@/types/strava';

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
  Legend
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
  const [showInfo, setShowInfo] = useState(false);

  const { labels, fitness, fatigue, form, fitnessScore, greenZone, redZone } = useMemo(() => {
    const daysBack = 90;
    const today = new Date();
    const start = subDays(today, daysBack);
    const allDays = eachDayOfInterval({ start, end: today });
    const labels = allDays.map((d) => format(d, 'MMM d'));
    const allSessions = [...sessions, ...completedSessions];

    const dailyLoad = allDays.map((day) => {
      const str = day.toISOString().split('T')[0];
      const s = allSessions.filter((sess) => sess.date.startsWith(str));
      const a = stravaActivities.filter((act) => act.start_date.startsWith(str));

      const sLoad = s.reduce((sum, x) => {
        const min = typeof x.duration === 'number'
          ? x.duration
          : estimateDurationFromTitle(x.title) ?? 0;
        return sum + min;
      }, 0);

      const aLoad = a.reduce((sum, x) => sum + (x.moving_time ?? 0) / 60, 0);
      return sLoad + aLoad;
    });

    const fitness: number[] = [];
    const fatigue: number[] = [];
    const form: number[] = [];
    const greenZone: number[] = [];
    const redZone: number[] = [];

    let ctl = 0;
    let atl = 0;
    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;

    dailyLoad.forEach(() => {
      greenZone.push(20);
      redZone.push(-30);
    });

    dailyLoad.forEach((load) => {
      ctl = ctl + ctlDecay * (load - ctl);
      atl = atl + atlDecay * (load - atl);
      const currentFitness = ctl;
      fitness.push(Math.round(currentFitness));
      fatigue.push(Math.round(atl));
      form.push(Math.round(currentFitness - atl));
    });

    const currentFitness = fitness.at(-1) ?? 0;
    const maxFitness = Math.max(...fitness.slice(-42));
    const fitnessScore = Math.round((currentFitness / maxFitness) * 100);

    return { labels, fitness, fatigue, form, fitnessScore, greenZone, redZone };
  }, [sessions, completedSessions, stravaActivities]);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-4 sm:p-6 shadow-sm relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          📈 Fitness Trends
        </h2>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          {showInfo ? 'Hide Info' : 'Learn how this works'}
        </button>
      </div>

      {showInfo && (
        <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
          <p><span className="font-semibold text-blue-600">Fitness</span> is a 6-week rolling average of your training load.</p>
          <p><span className="font-semibold text-purple-600">Fatigue</span> is a 1-week average — it spikes after intense blocks.</p>
          <p><span className="font-semibold text-green-600">Form</span> = Fitness − Fatigue. It measures how fresh or overreached you are.</p>
          <p>
            Stay in the <span className="text-green-600 font-medium">green zone</span> (moderate form) for fitness gains.
            Avoid the <span className="text-red-600 font-medium">high risk zone</span> for too long — it can lead to overtraining.
          </p>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: 'Fitness',
                  data: fitness,
                  borderColor: '#3B82F6',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  fill: true,
                  tension: 0.3,
                },
                {
                  label: 'Fatigue',
                  data: fatigue,
                  borderColor: '#C084FC',
                  backgroundColor: 'rgba(192, 132, 252, 0.2)',
                  fill: true,
                  tension: 0.3,
                },
                {
                  label: 'Form',
                  data: form,
                  borderColor: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  fill: true,
                  tension: 0.3,
                },
                {
                  label: 'Green Zone',
                  data: greenZone,
                  borderColor: 'rgba(34,197,94,0.5)',
                  borderDash: [5, 5],
                  pointRadius: 0,
                  fill: false,
                },
                {
                  label: 'High Risk Zone',
                  data: redZone,
                  borderColor: 'rgba(239,68,68,0.6)',
                  borderDash: [5, 5],
                  pointRadius: 0,
                  fill: false,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { boxWidth: 12, font: { size: 10 } },
                },
              },
              scales: {
                y: { beginAtZero: false },
              },
            }}
            height={280}
          />
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-700">
        Fitness Score: <span className="font-medium">{fitnessScore}/100</span>
      </div>
    </div>
  );
}
