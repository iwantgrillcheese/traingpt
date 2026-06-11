'use client';

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

type Props = {
  activity: StravaActivity | null | undefined;
  sportType?: string | null;
  plannedSession?: Pick<Session, 'duration'> | null;
  compact?: boolean;
};

type Stat = {
  label: string;
  value: string | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatDuration(seconds?: number | null) {
  if (!isFiniteNumber(seconds) || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatPlannedMinutes(minutes?: number | null) {
  if (!isFiniteNumber(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDistance(meters?: number | null) {
  if (!isFiniteNumber(meters) || meters <= 0) return null;
  if (meters >= 1609.34) return `${(meters / 1609.34).toFixed(2)} mi`;
  return `${Math.round(meters)} m`;
}

function formatPace(secondsPerMile: number) {
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = Math.round(secondsPerMile % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}/mi`;
}

function formatSpeed(activity: StravaActivity, sportType?: string | null) {
  const speed = activity.average_speed;
  if (!isFiniteNumber(speed) || speed <= 0) return null;

  const sport = String(sportType || activity.sport_type || '').toLowerCase();
  if (sport.includes('run')) return formatPace(1609.34 / speed);
  if (sport.includes('swim')) return `${formatPace(1609.34 / speed)}`;
  return `${(speed * 2.236936).toFixed(1)} mph`;
}

function formatHeartrate(value?: number | null) {
  if (!isFiniteNumber(value) || value <= 0) return null;
  return `${Math.round(value)} bpm`;
}

function formatWatts(value?: number | null) {
  if (!isFiniteNumber(value) || value <= 0) return null;
  return `${Math.round(value)} W`;
}

function formatElevation(meters?: number | null) {
  if (!isFiniteNumber(meters) || meters <= 0) return null;
  return `${Math.round(meters * 3.28084)} ft`;
}

function formatEnergy(kilojoules?: number | null) {
  if (!isFiniteNumber(kilojoules) || kilojoules <= 0) return null;
  return `${Math.round(kilojoules)} kJ`;
}

function formatDurationDelta(plannedMinutes?: number | null, actualSeconds?: number | null) {
  if (!isFiniteNumber(plannedMinutes) || !isFiniteNumber(actualSeconds)) return null;
  const deltaSeconds = Math.round(actualSeconds - plannedMinutes * 60);
  if (Math.abs(deltaSeconds) < 30) return 'On target';
  const prefix = deltaSeconds > 0 ? '+' : '−';
  const abs = Math.abs(deltaSeconds);
  const minutes = Math.round(abs / 60);
  return `${prefix}${minutes}m`;
}

function StatRow({ label, value }: Stat) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-b-0">
      <span className="text-[13px] font-medium text-zinc-500">{label}</span>
      <span className="text-right text-[13px] font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

export function getActivityHeroStats(activity: StravaActivity | null | undefined, sportType?: string | null) {
  if (!activity) return [];
  const sport = String(sportType || activity.sport_type || '').toLowerCase();
  return [
    { label: 'Duration', value: formatDuration(activity.moving_time) },
    { label: 'Distance', value: formatDistance(activity.distance) },
    { label: sport.includes('run') || sport.includes('swim') ? 'Avg pace' : 'Avg speed', value: formatSpeed(activity, sportType) },
    { label: 'Avg HR', value: formatHeartrate(activity.average_heartrate) },
  ].filter((stat) => stat.value);
}

export default function ActivityStatsPanel({ activity, sportType, plannedSession, compact = false }: Props) {
  if (!activity) return null;

  const sport = String(sportType || activity.sport_type || '').toLowerCase();
  const overview: Stat[] = [
    { label: 'Duration', value: formatDuration(activity.moving_time) },
    { label: 'Distance', value: formatDistance(activity.distance) },
    { label: sport.includes('run') || sport.includes('swim') ? 'Avg pace' : 'Avg speed', value: formatSpeed(activity, sportType) },
    { label: 'Elevation gain', value: formatElevation(activity.total_elevation_gain) },
  ];
  const effort: Stat[] = [
    { label: 'Avg HR', value: formatHeartrate(activity.average_heartrate) },
    { label: 'Max HR', value: formatHeartrate(activity.max_heartrate) },
    { label: 'Avg watts', value: formatWatts(activity.average_watts) },
    { label: 'Weighted watts', value: formatWatts(activity.weighted_average_watts) },
    { label: 'Energy', value: formatEnergy(activity.kilojoules) },
  ];

  const overviewStats = overview.filter((stat) => stat.value);
  const effortStats = effort.filter((stat) => stat.value);
  const plannedDuration = formatPlannedMinutes(plannedSession?.duration ?? null);
  const actualDuration = formatDuration(activity.moving_time);
  const durationDelta = formatDurationDelta(plannedSession?.duration ?? null, activity.moving_time);

  return (
    <section className={compact ? '' : 'rounded-2xl border border-[#E3E0D8] bg-white p-4'}>
      {!compact ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">Completed activity</div>
            <div className="mt-1 text-[14px] font-semibold text-zinc-950">Synced from Strava</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {overviewStats.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="text-[13px] font-semibold text-zinc-950">Overview</div>
            <div className="mt-2 divide-y divide-zinc-100">
              {overviewStats.map((stat) => <StatRow key={stat.label} {...stat} />)}
            </div>
          </div>
        ) : null}

        {effortStats.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="text-[13px] font-semibold text-zinc-950">Effort</div>
            <div className="mt-2 divide-y divide-zinc-100">
              {effortStats.map((stat) => <StatRow key={stat.label} {...stat} />)}
            </div>
          </div>
        ) : null}
      </div>

      {plannedDuration || actualDuration ? (
        <div className="mt-4 rounded-2xl border border-[#E3E0D8] bg-[#F7F6F2] p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CA3AF]">Plan vs actual</div>
          <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-3">
            {plannedDuration ? <div><span className="text-zinc-500">Planned</span><div className="font-semibold text-zinc-950">{plannedDuration}</div></div> : null}
            {actualDuration ? <div><span className="text-zinc-500">Completed</span><div className="font-semibold text-zinc-950">{actualDuration}</div></div> : null}
            {durationDelta ? <div><span className="text-zinc-500">Duration</span><div className="font-semibold text-zinc-950">{durationDelta}</div></div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
