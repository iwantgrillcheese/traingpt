'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import ActivityStatsPanel, { getActivityHeroStats } from './ActivityStatsPanel';
import type { StravaActivity } from '@/types/strava';

type Props = {
  activity: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  timezone?: string;
};

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
      return format(new Date(start), 'EEE, MMM d • h:mm a');
    } catch {
      return null;
    }
  }, [start]);

  const heroStats = getActivityHeroStats(activity, activity?.sport_type).slice(0, 4);

  const handleAnalyze = async () => {
    if (!activity) return;
    const stravaId = activity.strava_id ?? activity.id;
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to analyze activity.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const sportName = String(activity?.sport_type || '').replace(/([A-Z])/g, ' $1').trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#E3E0D8] bg-white shadow-[0_35px_100px_rgba(0,0,0,0.28)]">
        <div className="border-b border-[#E3E0D8] bg-[#F7F6F2] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-black tracking-[-0.035em] text-[#101114] truncate">{title}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <span className="rounded-full border border-[#E3E0D8] bg-white px-2.5 py-1 font-semibold text-[#6B7280]">{when || '—'}</span>
                <span className="rounded-full border border-[#E3E0D8] bg-white px-2.5 py-1 font-semibold text-[#6B7280]">{sportName || 'Activity'}</span>
              </div>
            </div>

            <button onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3E0D8] bg-white text-[#6B7280] hover:border-[#CFCBC1]" aria-label="Close">
              ✕
            </button>
          </div>

          {heroStats.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {heroStats.map((stat) => <HeroChip key={stat.label} label={stat.label} value={stat.value} />)}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Activity breakdown</div>
          <ActivityStatsPanel activity={activity} sportType={activity?.sport_type} compact />

          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={clsx('inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition', 'border border-black/10 bg-zinc-900 text-white hover:bg-zinc-800', loading && 'cursor-not-allowed opacity-60')}
            >
              {loading ? 'Analyzing…' : 'Analyze with Coach'}
            </button>
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
          </div>

          {analysis ? (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-semibold text-zinc-900">Coach analysis</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{analysis}</div>
            </div>
          ) : (
            <div className="mt-5 text-sm text-zinc-500">Tip: Analyzing is best when you’ve got planned sessions in the calendar — we can compare compliance and adjust tomorrow.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-[#E3E0D8] bg-white px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-[#101114]">{value || '—'}</div>
    </div>
  );
}
