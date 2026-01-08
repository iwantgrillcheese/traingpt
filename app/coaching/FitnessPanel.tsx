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
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import clsx from 'clsx';

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
  stravaActivities: StravaActivity[];
  sessions?: Session[]; // accepted but unused for now
  completedSessions?: Session[]; // accepted but unused for now
  windowDays?: number; // NEW: controls range (e.g. 7/30/90/182/365)
};

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

// A simple, honest “training load” proxy for v1: total hours trained per day
function dailyLoadHoursForDay(activities: StravaActivity[], day: Date) {
  const key = dayKey(day);
  const dayActs = activities.filter((a) => String(a.start_date || '').startsWith(key));
  const seconds = dayActs.reduce((sum, a) => sum + (a.moving_time ?? 0), 0);
  return seconds / 3600;
}

export default function FitnessPanel({
  stravaActivities = [],
  windowDays = 90,
}: FitnessPanelProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { labels, fitness, fatigue, form, fitnessScore } = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, Math.max(1, windowDays) - 1);
    const allDays = eachDayOfInterval({ start, end: today });

    const labels = allDays.map((d) => format(d, windowDays <= 30 ? 'MMM d' : 'MMM d'));

    const dailyLoad = allDays.map((day) => dailyLoadHoursForDay(stravaActivities, day));

    // EWMA model (CTL/ATL style), expressed in “hours-equivalent load”
    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;

    let ctl = 0;
    let atl = 0;

    const fitness: number[] = [];
    const fatigue: number[] = [];
    const form: number[] = [];

    dailyLoad.forEach((load) => {
      ctl = ctl + ctlDecay * (load - ctl);
      atl = atl + atlDecay * (load - atl);

      fitness.push(Number(ctl.toFixed(2)));
      fatigue.push(Number(atl.toFixed(2)));
      form.push(Number((ctl - atl).toFixed(2)));
    });

    const currentFitness = fitness.at(-1) ?? 0;
    const lookback = Math.min(42, fitness.length);
    const maxFitness = Math.max(...fitness.slice(-lookback), 0.0001);
    const fitnessScore = Math.round((currentFitness / maxFitness) * 100);

    return { labels, fitness, fatigue, form, fitnessScore };
  }, [stravaActivities, windowDays]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Fitness trend</h3>
          <p className="mt-1 text-xs text-gray-500">
            Fitness (42d) vs Fatigue (7d) from completed Strava training.
          </p>
        </div>

        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          {showInfo ? 'Hide' : 'What is this?'}
        </button>
      </div>

      {showInfo ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <div className="space-y-2 leading-relaxed">
            <p>
              <span className="font-semibold text-gray-900">Fitness</span> is a 42-day moving estimate of your training load.
              <span className="mx-1 text-gray-300">•</span>
              <span className="font-semibold text-gray-900">Fatigue</span> is a 7-day estimate.
            </p>
            <p>
              <span className="font-semibold text-gray-900">Form</span> = Fitness − Fatigue. Negative form can be normal during hard blocks.
            </p>
            <p className="text-xs text-gray-500">
              v1 note: load is modeled from training duration (hours). Later we can weight by intensity (power/HR).
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <div className={clsx('h-[280px] w-full', windowDays <= 30 ? '' : '')}>
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: 'Fitness',
                  data: fitness,
                  borderColor: '#111827',
                  backgroundColor: 'rgba(17, 24, 39, 0.08)',
                  fill: true,
                  tension: 0.25,
                  pointRadius: 0,
                  borderWidth: 2,
                },
                {
                  label: 'Fatigue',
                  data: fatigue,
                  borderColor: 'rgba(17, 24, 39, 0.55)',
                  backgroundColor: 'rgba(17, 24, 39, 0.04)',
                  fill: true,
                  tension: 0.25,
                  pointRadius: 0,
                  borderWidth: 1.5,
                },
                {
                  label: 'Form',
                  data: form,
                  borderColor: 'rgba(17, 24, 39, 0.25)',
                  backgroundColor: 'rgba(17, 24, 39, 0.03)',
                  fill: false,
                  tension: 0.25,
                  pointRadius: 0,
                  borderWidth: 1.25,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom',
                  labels: {
                    boxWidth: 10,
                    boxHeight: 10,
                    color: '#6B7280',
                    font: { size: 11, weight: '500' as any },
                    padding: 16,
                  },
                },
                tooltip: {
                  intersect: false,
                  mode: 'index',
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.y;
                      return `${ctx.dataset.label}: ${Number(v).toFixed(2)}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: '#9CA3AF', maxTicksLimit: 8 },
                },
                y: {
                  grid: { color: 'rgba(17, 24, 39, 0.06)' },
                  ticks: { color: '#9CA3AF', maxTicksLimit: 6 },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">Fitness score</div>
        <div className="text-sm font-semibold text-gray-900">{fitnessScore}/100</div>
      </div>
    </div>
  );
}
