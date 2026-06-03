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
  sessions?: Session[];
  completedSessions?: Session[];
  windowDays?: number;
};

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function dailyLoadHoursForDay(activities: StravaActivity[], day: Date) {
  const key = dayKey(day);
  const dayActs = activities.filter((a) => String(a.start_date || '').startsWith(key));
  const seconds = dayActs.reduce((sum, a) => sum + (a.moving_time ?? 0), 0);
  return seconds / 3600;
}

function trendLabel(score: number, hasData: boolean) {
  if (!hasData) return 'Connect Strava to build your trend';
  if (score >= 85) return 'Fitness is near your recent peak';
  if (score >= 65) return 'Fitness is building steadily';
  return 'Fitness base is forming';
}

export default function FitnessPanel({
  stravaActivities = [],
  windowDays = 90,
}: FitnessPanelProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { labels, fitness, fatigue, form, fitnessScore, hasData } = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, Math.max(1, windowDays) - 1);
    const allDays = eachDayOfInterval({ start, end: today });
    const labels = allDays.map((d) => format(d, 'MMM d'));
    const dailyLoad = allDays.map((day) => dailyLoadHoursForDay(stravaActivities, day));
    const hasData = dailyLoad.some((load) => load > 0);

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
    const fitnessScore = hasData ? Math.round((currentFitness / maxFitness) * 100) : 0;

    return { labels, fitness, fatigue, form, fitnessScore, hasData };
  }, [stravaActivities, windowDays]);

  return (
    <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Fitness trend</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
            {trendLabel(fitnessScore, hasData)}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            A quiet view of fitness, fatigue, and form based on completed Strava training load.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Fitness score</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{hasData ? fitnessScore : '—'}<span className="text-sm font-medium text-zinc-400">/100</span></p>
        </div>
      </div>

      {showInfo ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-[#fbfaf8] p-4 text-sm leading-6 text-zinc-600">
          Fitness is a 42-day estimate of training load. Fatigue is a 7-day estimate. Form is fitness minus fatigue, so negative form can be normal during hard blocks. This v1 model uses duration until power and heart-rate weighting are added.
        </div>
      ) : null}

      <div className="mt-6 h-[260px] w-full sm:h-[300px]">
        {hasData ? (
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: 'Fitness',
                  data: fitness,
                  borderColor: '#09090b',
                  backgroundColor: 'rgba(9, 9, 11, 0.06)',
                  fill: true,
                  tension: 0.35,
                  pointRadius: 0,
                  borderWidth: 2.4,
                },
                {
                  label: 'Fatigue',
                  data: fatigue,
                  borderColor: 'rgba(9, 9, 11, 0.42)',
                  backgroundColor: 'rgba(9, 9, 11, 0.025)',
                  fill: true,
                  tension: 0.35,
                  pointRadius: 0,
                  borderWidth: 1.6,
                },
                {
                  label: 'Form',
                  data: form,
                  borderColor: 'rgba(31, 107, 79, 0.72)',
                  backgroundColor: 'transparent',
                  fill: false,
                  tension: 0.35,
                  pointRadius: 0,
                  borderWidth: 1.5,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { intersect: false, mode: 'index' },
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom',
                  labels: {
                    usePointStyle: true,
                    pointStyle: 'line',
                    color: '#71717a',
                    font: { size: 11, weight: '500' as any },
                    padding: 18,
                  },
                },
                tooltip: {
                  intersect: false,
                  mode: 'index',
                  backgroundColor: '#09090b',
                  titleColor: '#ffffff',
                  bodyColor: '#e4e4e7',
                  borderWidth: 0,
                  padding: 12,
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}`,
                  },
                },
              },
              scales: {
                x: {
                  border: { display: false },
                  grid: { display: false },
                  ticks: { color: '#a1a1aa', maxTicksLimit: 6, font: { size: 11 } },
                },
                y: {
                  border: { display: false },
                  grid: { color: 'rgba(9, 9, 11, 0.055)' },
                  ticks: { color: '#a1a1aa', maxTicksLimit: 5, font: { size: 11 } },
                },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-[#fbfaf8] px-6 text-center">
            <div>
              <p className="text-base font-semibold tracking-tight text-zinc-950">No fitness trend yet</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Connect Strava and complete a few sessions. Your fitness, fatigue, and form will appear here automatically.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs font-medium text-zinc-500 transition hover:text-zinc-950"
        >
          {showInfo ? 'Hide explanation' : 'How this works'}
        </button>
        <p className="text-xs text-zinc-400">Based on completed Strava work</p>
      </div>
    </div>
  );
}
