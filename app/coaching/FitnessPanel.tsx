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

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Filler, Legend);

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

export default function FitnessPanel({ stravaActivities = [], windowDays = 90 }: FitnessPanelProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { labels, fitness, fatigue, form, fitnessScore, interpretation } = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, Math.max(1, windowDays) - 1);
    const allDays = eachDayOfInterval({ start, end: today });

    const labels = allDays.map((d) => format(d, 'MMM d'));
    const dailyLoad = allDays.map((day) => dailyLoadHoursForDay(stravaActivities, day));

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

    const formNow = form.at(-1) ?? 0;
    const interpretation =
      formNow <= -2.5
        ? 'Recovery Deficit — reduce intensity for 24h and protect sleep.'
        : formNow <= -0.5
        ? 'Productive Strain — keep quality controlled and avoid extra load.'
        : formNow < 1.5
        ? 'Stable Progression — current load is balanced and sustainable.'
        : 'Under-Stimulated — add one focused quality session this week.';

    return { labels, fitness, fatigue, form, fitnessScore, interpretation };
  }, [stravaActivities, windowDays]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0b0d10] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Load interpretation</h3>
          <p className="mt-1 text-xs text-zinc-500">Engineered from 42d fitness vs 7d fatigue load.</p>
        </div>
        <button onClick={() => setShowInfo((v) => !v)} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">
          {showInfo ? 'Hide model' : 'Model details'}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-zinc-800 bg-[#101318] px-3 py-2 text-sm text-zinc-300">{interpretation}</div>

      {showInfo ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-[#101318] p-3 text-xs leading-relaxed text-zinc-400">
          Fitness = 42-day load, Fatigue = 7-day load, Form = Fitness − Fatigue. Higher fatigue is expected in hard blocks.
        </div>
      ) : null}

      <div className="mt-4 h-[300px] w-full">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: 'Fitness',
                data: fitness,
                borderColor: '#E5E7EB',
                backgroundColor: 'rgba(229,231,235,0.08)',
                fill: true,
                tension: 0.22,
                pointRadius: 0,
                borderWidth: 2,
              },
              {
                label: 'Fatigue',
                data: fatigue,
                borderColor: 'rgba(161,161,170,0.75)',
                backgroundColor: 'rgba(161,161,170,0.05)',
                fill: true,
                tension: 0.22,
                pointRadius: 0,
                borderWidth: 1.5,
              },
              {
                label: 'Form',
                data: form,
                borderColor: 'rgba(113,113,122,0.8)',
                backgroundColor: 'rgba(113,113,122,0.0)',
                fill: false,
                tension: 0.2,
                pointRadius: 0,
                borderWidth: 1.25,
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
                  boxWidth: 10,
                  boxHeight: 10,
                  color: '#A1A1AA',
                  font: { size: 11, weight: '500' as any },
                  padding: 14,
                },
              },
              tooltip: {
                backgroundColor: '#111318',
                borderColor: '#27272A',
                borderWidth: 1,
                titleColor: '#E4E4E7',
                bodyColor: '#D4D4D8',
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}`,
                },
              },
            },
            scales: {
              x: {
                grid: { color: 'rgba(255,255,255,0.03)' },
                ticks: { color: '#71717A', maxTicksLimit: 8 },
              },
              y: {
                grid: { color: 'rgba(255,255,255,0.06)' },
                ticks: { color: '#71717A', maxTicksLimit: 6 },
              },
            },
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="text-xs text-zinc-500">Fitness score</div>
        <div className="text-sm font-semibold text-zinc-100">{fitnessScore}/100</div>
      </div>
    </div>
  );
}
