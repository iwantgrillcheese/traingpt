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

  const { labels, fitness, fatigue, form, fitnessScore } = useMemo(() => {
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

    let ctl = 0; // fitness (42-day EWMA)
    let atl = 0; // fatigue (7-day EWMA)
    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;

    dailyLoad.forEach((load) => {
      ctl = ctl + ctlDecay * (load - ctl);
      atl = atl + atlDecay * (load - atl);
      fitness.push(Math.round(ctl));
      fatigue.push(Math.round(atl));
      form.push(Math.round(ctl - atl));
    });

    const avgHours = fitness.reduce((sum, x) => sum + x, 0) / fitness.length / 60;
    const fitnessScore = Math.min(100, Math.max(0, Math.round(avgHours * 100)));

    return { labels, fitness, fatigue, form, fitnessScore };
  }, [sessions, completedSessions, stravaActivities]);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm relative">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">📈 Fitness Trends</h2>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          {showInfo ? 'Hide Info' : 'Learn how this works'}
        </button>
      </div>

      {showInfo && (
        <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
          <p><span className="font-semibold text-blue-600">Fitness</span> is a 6-week rolling average of your training load.</p>
          <p><span className="font-semibold text-purple-600">Fatigue</span> is a 1-week average — it spikes after intense blocks.</p>
          <p><span className="font-semibold text-green-600">Form</span> = Fitness − Fatigue. It measures how fresh or overreached you are.</p>
          <p className="mt-2">
            Stay in the <span className="text-green-600 font-medium">green zone</span> (moderate form) for fitness gains. Avoid the
            <span className="text-red-600 font-medium"> high risk zone</span> (very low form) for too long — it can lead to overtraining.
          </p>
        </div>
      )}

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
            ],
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
            },
            scales: {
              y: { beginAtZero: true },
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
