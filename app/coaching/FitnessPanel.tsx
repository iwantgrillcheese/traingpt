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

// The model needs runway before the visible window or every curve starts at
// zero and "rises" to today, which made the old score 100/100 by construction.
const LEAD_IN_DAYS = 42;

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function buildDailyLoadMap(activities: StravaActivity[]) {
  const map = new Map<string, number>();
  for (const activity of activities) {
    const key = String(activity.start_date || '').slice(0, 10);
    if (!key) continue;
    const seconds = Number(activity.moving_time ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    map.set(key, (map.get(key) ?? 0) + seconds / 3600);
  }
  return map;
}

type TrendDirection = 'building' | 'steady' | 'easing' | 'baseline';

function headlineFor(direction: TrendDirection, hasData: boolean) {
  if (!hasData) return 'Connect Strava to build your trend';
  if (direction === 'baseline') return 'Building your baseline';
  if (direction === 'building') return 'Training load is building';
  if (direction === 'easing') return 'Training load is easing off';
  return 'Training load is holding steady';
}

function formStateFor(ctl: number, atl: number): { label: string; caption: string } {
  const tsbRatio = ctl > 0.01 ? (ctl - atl) / ctl : 0;
  if (tsbRatio >= 0.1) return { label: 'Fresh', caption: 'recovered vs recent load' };
  if (tsbRatio <= -0.15) return { label: 'Loading', caption: 'absorbing recent work' };
  return { label: 'Steady', caption: 'load and recovery balanced' };
}

export default function FitnessPanel({
  stravaActivities = [],
  windowDays = 90,
}: FitnessPanelProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { labels, fitness, fatigue, form, hasData, weeklyLoadHours, formState, direction } = useMemo(() => {
    const today = startOfDay(new Date());
    const displayStart = subDays(today, Math.max(1, windowDays) - 1);
    const computeStart = subDays(displayStart, LEAD_IN_DAYS);
    const allDays = eachDayOfInterval({ start: computeStart, end: today });

    const loadByDay = buildDailyLoadMap(stravaActivities);

    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;
    let ctl = 0;
    let atl = 0;

    const fullFitness: number[] = [];
    const fullFatigue: number[] = [];
    const fullForm: number[] = [];

    for (const day of allDays) {
      const load = loadByDay.get(dayKey(day)) ?? 0;
      ctl = ctl + ctlDecay * (load - ctl);
      atl = atl + atlDecay * (load - atl);
      fullFitness.push(Number(ctl.toFixed(3)));
      fullFatigue.push(Number(atl.toFixed(3)));
      fullForm.push(Number((ctl - atl).toFixed(3)));
    }

    // Display only the requested window; the lead-in exists so the model has
    // converged by the first visible day.
    const sliceFrom = allDays.length - Math.max(1, windowDays);
    const displayDays = allDays.slice(sliceFrom);
    const labels = displayDays.map((d) => format(d, 'MMM d'));
    const fitness = fullFitness.slice(sliceFrom);
    const fatigue = fullFatigue.slice(sliceFrom);
    const form = fullForm.slice(sliceFrom);

    const activeDays = displayDays.filter((day) => (loadByDay.get(dayKey(day)) ?? 0) > 0).length;
    const hasData = activeDays > 0;

    const currentCtl = fitness.at(-1) ?? 0;
    const currentAtl = fatigue.at(-1) ?? 0;
    const weeklyLoadHours = currentCtl * 7;

    // Trend: sustained load now vs ~two weeks ago. New athletes (or sparse
    // data) get an honest "baseline" state instead of a verdict.
    let direction: TrendDirection = 'steady';
    const compareIndex = fitness.length - 15;
    if (activeDays < 5 || compareIndex < 0 || (fitness[compareIndex] ?? 0) < 0.02) {
      direction = 'baseline';
    } else {
      const prior = fitness[compareIndex];
      const delta = prior > 0 ? (currentCtl - prior) / prior : 0;
      if (delta >= 0.08) direction = 'building';
      else if (delta <= -0.08) direction = 'easing';
    }

    return {
      labels,
      fitness,
      fatigue,
      form,
      hasData,
      weeklyLoadHours,
      formState: formStateFor(currentCtl, currentAtl),
      direction,
    };
  }, [stravaActivities, windowDays]);

  return (
    <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Training load</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
            {headlineFor(direction, hasData)}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            Fitness (42-day load), fatigue (7-day), and form — from your completed Strava work.
          </p>
        </div>

        {hasData ? (
          <div className="flex gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Sustained load</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {weeklyLoadHours.toFixed(1)}
                <span className="text-sm font-medium text-zinc-400"> h/wk</span>
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Form</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{formState.label}</p>
              <p className="text-[11px] text-zinc-400">{formState.caption}</p>
            </div>
          </div>
        ) : null}
      </div>

      {showInfo ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-[#fbfaf8] p-4 text-sm leading-6 text-zinc-600">
          Fitness is a 42-day rolling estimate of training load, fatigue a 7-day estimate, and form is the
          difference — negative form is normal and expected during hard blocks. Sustained load is your current
          fitness expressed as weekly hours. This v1 model is duration-based until power and heart-rate
          weighting are added, and it gets meaningfully accurate after a few weeks of data.
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
                    label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)} h/day`,
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
                  title: { display: true, text: 'h/day', color: '#a1a1aa', font: { size: 10 } },
                },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-[#fbfaf8] px-6 text-center">
            <div>
              <p className="text-base font-semibold tracking-tight text-zinc-950">No training load yet</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Connect Strava and complete a few sessions. Your load, fatigue, and form will build here automatically.</p>
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
