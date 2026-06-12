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
// zero and "rises" to today.
const LEAD_IN_DAYS = 42;

// Form zone bands, in minutes/day of training-load balance. The familiar
// fresh / grey / optimal / high-strain reading, scaled to a duration-based
// load model (v1 — power/HR weighting upgrades this later).
const FORM_BANDS = [
  { from: 15, to: 999, color: 'rgba(250, 204, 21, 0.10)' },
  { from: 3, to: 15, color: 'rgba(59, 130, 246, 0.08)' },
  { from: -5, to: 3, color: 'rgba(107, 114, 128, 0.07)' },
  { from: -20, to: -5, color: 'rgba(34, 197, 94, 0.10)' },
  { from: -999, to: -20, color: 'rgba(239, 68, 68, 0.08)' },
];

const formBandsPlugin = {
  id: 'formBands',
  beforeDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.y) return;
    for (const band of FORM_BANDS) {
      const yTop = Math.max(chartArea.top, scales.y.getPixelForValue(band.to));
      const yBottom = Math.min(chartArea.bottom, scales.y.getPixelForValue(band.from));
      if (yBottom <= yTop) continue;
      ctx.save();
      ctx.fillStyle = band.color;
      ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBottom - yTop);
      ctx.restore();
    }
  },
};

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
    map.set(key, (map.get(key) ?? 0) + seconds / 60); // minutes
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

function formZone(form: number): { label: string; caption: string } {
  if (form > 15) return { label: 'Transition', caption: 'very fresh — race or rebuild' };
  if (form >= 3) return { label: 'Fresh', caption: 'ready for key sessions' };
  if (form >= -5) return { label: 'Steady', caption: 'load and recovery balanced' };
  if (form >= -20) return { label: 'Building', caption: 'productive training stress' };
  return { label: 'High strain', caption: 'easy days earn the next block' };
}

export default function FitnessPanel({
  stravaActivities = [],
  windowDays = 90,
}: FitnessPanelProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { labels, fitness, fatigue, form, hasData, weeklyLoadHours, zone, direction } = useMemo(() => {
    const today = startOfDay(new Date());
    const displayStart = subDays(today, Math.max(1, windowDays) - 1);
    const computeStart = subDays(displayStart, LEAD_IN_DAYS);
    const allDays = eachDayOfInterval({ start: computeStart, end: today });

    const loadByDay = buildDailyLoadMap(stravaActivities);

    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;
    let ctl = 0; // minutes/day
    let atl = 0;

    const fullFitness: number[] = [];
    const fullFatigue: number[] = [];
    const fullForm: number[] = [];

    for (const day of allDays) {
      const load = loadByDay.get(dayKey(day)) ?? 0;
      ctl = ctl + ctlDecay * (load - ctl);
      atl = atl + atlDecay * (load - atl);
      fullFitness.push(Math.round(ctl));
      fullFatigue.push(Math.round(atl));
      fullForm.push(Math.round(ctl - atl));
    }

    const sliceFrom = allDays.length - Math.max(1, windowDays);
    const displayDays = allDays.slice(sliceFrom);
    const labels = displayDays.map((d) => format(d, 'MMM d'));
    const fitness = fullFitness.slice(sliceFrom);
    const fatigue = fullFatigue.slice(sliceFrom);
    const form = fullForm.slice(sliceFrom);

    const activeDays = displayDays.filter((day) => (loadByDay.get(dayKey(day)) ?? 0) > 0).length;
    const hasData = activeDays > 0;

    const currentCtl = fitness.at(-1) ?? 0;
    const currentForm = form.at(-1) ?? 0;
    const weeklyLoadHours = (currentCtl * 7) / 60;

    let direction: TrendDirection = 'steady';
    const compareIndex = fitness.length - 15;
    if (activeDays < 5 || compareIndex < 0 || (fitness[compareIndex] ?? 0) < 1) {
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
      zone: formZone(currentForm),
      direction,
    };
  }, [stravaActivities, windowDays]);

  const sharedX = {
    border: { display: false },
    grid: { display: false },
    ticks: { color: '#a1a1aa', maxTicksLimit: 6, font: { size: 11 } },
  };

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
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{zone.label}</p>
              <p className="text-[11px] text-zinc-400">{zone.caption}</p>
            </div>
          </div>
        ) : null}
      </div>

      {showInfo ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-[#fbfaf8] p-4 text-sm leading-6 text-zinc-600">
          Fitness is a 42-day rolling estimate of daily training load (minutes/day), fatigue a 7-day
          estimate, and form is the difference. The colored bands read like a coach would: blue means
          fresh enough for key sessions, green means productive building stress, red means strain that
          needs easy days, and yellow means very fresh — taper or layoff. This v1 model is
          duration-based until power and heart-rate weighting are added.
        </div>
      ) : null}

      {hasData ? (
        <>
          <div className="mt-6 h-[220px] w-full sm:h-[250px]">
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: 'Fitness',
                    data: fitness,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 2.2,
                  },
                  {
                    label: 'Fatigue',
                    data: fatigue,
                    borderColor: 'rgba(139, 92, 246, 0.85)',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 1.4,
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
                    position: 'top',
                    align: 'end',
                    labels: {
                      usePointStyle: true,
                      pointStyle: 'line',
                      color: '#71717a',
                      font: { size: 11, weight: '500' as any },
                      padding: 14,
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
                      label: (ctx) => `${ctx.dataset.label}: ${Math.round(Number(ctx.parsed.y))} min/day`,
                    },
                  },
                },
                scales: {
                  x: { ...sharedX, ticks: { ...sharedX.ticks, display: false } },
                  y: {
                    border: { display: false },
                    grid: { color: 'rgba(9, 9, 11, 0.05)' },
                    ticks: { color: '#a1a1aa', maxTicksLimit: 5, precision: 0, font: { size: 11 } },
                    title: { display: true, text: 'min/day', color: '#a1a1aa', font: { size: 10 } },
                  },
                },
              }}
            />
          </div>

          <div className="mt-2 h-[130px] w-full">
            <Line
              plugins={[formBandsPlugin]}
              data={{
                labels,
                datasets: [
                  {
                    label: 'Form',
                    data: form,
                    borderColor: '#374151',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 1.6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    intersect: false,
                    mode: 'index',
                    backgroundColor: '#09090b',
                    titleColor: '#ffffff',
                    bodyColor: '#e4e4e7',
                    borderWidth: 0,
                    padding: 12,
                    callbacks: {
                      label: (ctx) => {
                        const value = Math.round(Number(ctx.parsed.y));
                        return `Form: ${value} (${formZone(value).label})`;
                      },
                    },
                  },
                },
                scales: {
                  x: sharedX,
                  y: {
                    border: { display: false },
                    grid: { display: false },
                    suggestedMin: -30,
                    suggestedMax: 20,
                    ticks: { color: '#a1a1aa', maxTicksLimit: 4, precision: 0, font: { size: 11 } },
                    title: { display: true, text: 'form', color: '#a1a1aa', font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </>
      ) : (
        <div className="mt-6 flex h-[260px] items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-[#fbfaf8] px-6 text-center">
          <div>
            <p className="text-base font-semibold tracking-tight text-zinc-950">No training load yet</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Connect Strava and complete a few sessions. Your load, fatigue, and form will build here automatically.</p>
          </div>
        </div>
      )}

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
