'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { StravaActivity } from '@/types/strava';

type Props = {
  activity: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  timezone?: string;
};

function formatDistanceMiles(distance?: number | null) {
  if (!distance) return '—';
  return `${(distance / 1609.34).toFixed(2)} mi`;
}

function formatDuration(movingTime?: number | null) {
  if (!movingTime) return '—';
  const h = Math.floor(movingTime / 3600);
  const m = Math.round((movingTime % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatPaceOrSpeed(activity: any) {
  const sport = String(activity?.sport_type || '').toLowerCase();
  const speed = activity?.average_speed; // m/s
  if (!speed) return '—';

  // runs: show pace
  if (sport.includes('run')) {
    const paceSecPerMi = 1609.34 / speed;
    const mm = Math.floor(paceSecPerMi / 60);
    const ss = Math.round(paceSecPerMi % 60)
      .toString()
      .padStart(2, '0');
    return `${mm}:${ss} /mi`;
  }

  // rides: show mph
  const mph = speed * 2.236936;
  return `${mph.toFixed(1)} mph`;
}

function metricRow(label: string, value: string) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

export default function StravaActivityModal({ activity, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setAnalysis(null);
      setError(null);
    }
  }, [open]);

  const title = activity?.name || 'Strava Activity';
  const start = activity?.start_date_local || activity?.start_date;

  const when = useMemo(() => {
    if (!start) return null;
    try {
      return format(new Date(start as any), "EEE, MMM d • h:mm a");
    } catch {
      return null;
    }
  }, [start]);

  const distance = formatDistanceMiles(activity?.distance ?? null);
  const duration = formatDuration(activity?.moving_time ?? null);
  const paceOrSpeed = formatPaceOrSpeed(activity);

  const avgHr = activity?.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '—';
  const maxHr = activity?.max_heartrate ? `${Math.round(activity.max_heartrate)} bpm` : '—';

  const avgWatts = activity?.average_watts ? `${Math.round(activity.average_watts)} w` : '—';
  const wAvgWatts = activity?.weighted_average_watts ? `${Math.round(activity.weighted_average_watts)} w` : '—';

  const elev = activity?.total_elevation_gain ? `${Math.round(activity.total_elevation_gain)} m` : '—';
  const kj = activity?.kilojoules ? `${Math.round(activity.kilojoules)} kJ` : '—';

  const handleAnalyze = async () => {
    if (!activity) return;
    const stravaId = (activity as any).strava_id ?? (activity as any).id;
    if (!stravaId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/strava/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to analyze activity.');

      setAnalysis(data?.analysis ?? 'No analysis returned.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to analyze activity.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const sportName = String(activity?.sport_type || '').replace(/([A-Z])/g, ' $1').trim();
  const isRun = String(activity?.sport_type || '')
    .toLowerCase()
    .includes('run');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl rounded-3xl border border-black/10 bg-white shadow-[0_35px_100px_rgba(0,0,0,0.35)]">
        <div className="bg-gradient-to-r from-zinc-700/95 to-slate-500/85 px-6 py-5 text-white rounded-t-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-white truncate">{title}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-semibold">
                  {when ? when : '—'}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-semibold">
                  {sportName || 'Activity'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/20"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <HeroChip label="Duration" value={duration} />
            <HeroChip label="Distance" value={distance} />
            <HeroChip label={isRun ? 'Avg pace' : 'Avg speed'} value={paceOrSpeed} />
            <HeroChip label="Load" value={String((activity as any)?.suffer_score ?? '—')} />
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200">
          <div className="min-w-0">
            <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Activity breakdown</div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
              <div className="text-sm font-semibold text-gray-900">Overview</div>
              <div className="mt-2 divide-y divide-gray-100">
                {metricRow('Duration', duration)}
                {metricRow('Distance', distance)}
                {metricRow(isRun ? 'Avg pace' : 'Avg speed', paceOrSpeed)}
                {metricRow('Elevation gain', elev)}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
              <div className="text-sm font-semibold text-gray-900">Effort</div>
              <div className="mt-2 divide-y divide-gray-100">
                {metricRow('Avg HR', avgHr)}
                {metricRow('Max HR', maxHr)}
                {metricRow('Avg watts', avgWatts)}
                {metricRow('Weighted watts', wAvgWatts)}
                {metricRow('Energy', kj)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={clsx(
                'inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                'border border-black/10 bg-zinc-900 text-white hover:bg-zinc-800',
                loading && 'opacity-60 cursor-not-allowed'
              )}
            >
              {loading ? 'Analyzing…' : 'Analyze with Coach'}
            </button>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}
          </div>

          {analysis ? (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Coach analysis</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                {analysis}
              </div>
            </div>
          ) : (
            <div className="mt-5 text-sm text-gray-500">
              Tip: Analyzing is best when you’ve got planned sessions in the calendar — we can compare compliance and adjust tomorrow.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-white">{value || '—'}</div>
    </div>
  );
}
