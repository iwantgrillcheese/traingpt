'use client';

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

type Props = {
  activity: StravaActivity | null | undefined;
  sportType?: string | null;
  plannedSession?: Pick<Session, 'duration' | 'details' | 'structured_workout'> | null;
  compact?: boolean;
};

type Stat = {
  label: string;
  value: string | null;
};

type Range = {
  min: number;
  max: number;
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

function formatDeltaMinutes(plannedMinutes?: number | null, actualSeconds?: number | null) {
  if (!isFiniteNumber(plannedMinutes) || !isFiniteNumber(actualSeconds)) return null;
  return Math.round(actualSeconds / 60 - plannedMinutes);
}

function getPrescriptionText(plannedSession?: Props['plannedSession']) {
  return `${plannedSession?.details ?? ''}\n${plannedSession?.structured_workout ?? ''}`;
}

function parseRangeFromText(text: string, unitPattern: string): Range | null {
  const matches = Array.from(
    text.matchAll(new RegExp(`(\\d{2,4})\\s*(?:-|–|—|to)\\s*(\\d{2,4})\\s*(?:${unitPattern})`, 'gi')),
  );

  const ranges = matches
    .map((match) => ({ min: Number(match[1]), max: Number(match[2]) }))
    .filter((range) => range.min > 0 && range.max > range.min);

  if (!ranges.length) return null;

  // Plans often include warm-up and cool-down ranges before the main set.
  // For execution feedback, the highest valid range usually reflects the prescribed work interval.
  return ranges.sort((a, b) => (b.min + b.max) / 2 - (a.min + a.max) / 2)[0];
}

function parsePowerTarget(text: string) {
  return parseRangeFromText(text, 'w|watts');
}

function parseHeartRateTarget(text: string) {
  return parseRangeFromText(text, 'bpm|beats(?: per minute)?');
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
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

function DurationBars({ plannedMinutes, actualSeconds }: { plannedMinutes?: number | null; actualSeconds?: number | null }) {
  if (!isFiniteNumber(plannedMinutes) || !isFiniteNumber(actualSeconds)) return null;

  const completedMinutes = Math.round(actualSeconds / 60);
  const max = Math.max(plannedMinutes, completedMinutes, 1);
  const plannedWidth = clampPercent((plannedMinutes / max) * 100);
  const completedWidth = clampPercent((completedMinutes / max) * 100);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-zinc-950">Duration</div>
        <div className="text-[12px] font-semibold text-zinc-500">{formatDurationDelta(plannedMinutes, actualSeconds)}</div>
      </div>
      <div className="mt-4 space-y-3">
        <ChartBar label="Planned" value={formatPlannedMinutes(plannedMinutes)} width={plannedWidth} tone="muted" />
        <ChartBar label="Completed" value={formatPlannedMinutes(completedMinutes)} width={completedWidth} tone="blue" />
      </div>
    </div>
  );
}

function ChartBar({ label, value, width, tone }: { label: string; value: string | null; width: number; tone: 'blue' | 'muted' | 'orange' }) {
  const fillClass = tone === 'blue' ? 'bg-[#2563FF]' : tone === 'orange' ? 'bg-[#FF6A00]' : 'bg-zinc-300';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        <span className="font-medium text-zinc-500">{label}</span>
        <span className="font-semibold text-zinc-950">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={`${fillClass} h-full rounded-full`} style={{ width: `${clampPercent(width)}%` }} />
      </div>
    </div>
  );
}

function TargetBandChart({
  title,
  target,
  values,
  unit,
}: {
  title: string;
  target: Range | null;
  values: Array<{ label: string; value: number | null | undefined }>;
  unit: string;
}) {
  const cleanValues = values.filter((item): item is { label: string; value: number } => isFiniteNumber(item.value) && item.value > 0);
  if (!cleanValues.length) return null;

  const maxValue = Math.max(target?.max ?? 0, ...cleanValues.map((item) => item.value));
  const scaleMax = Math.max(1, Math.ceil(maxValue * 1.18));
  const targetLeft = target ? clampPercent((target.min / scaleMax) * 100) : 0;
  const targetWidth = target ? clampPercent(((target.max - target.min) / scaleMax) * 100) : 0;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-zinc-950">{title}</div>
          <div className="mt-0.5 text-[12px] font-medium text-zinc-500">
            {target ? `Target ${target.min}-${target.max} ${unit}` : 'No exact target found'}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {target ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <span>Target band</span>
              <span>{scaleMax} {unit}</span>
            </div>
            <div className="relative h-3 rounded-full bg-zinc-100">
              <div
                className="absolute top-0 h-3 rounded-full bg-[#C6F33C]"
                style={{ left: `${targetLeft}%`, width: `${targetWidth}%` }}
              />
            </div>
          </div>
        ) : null}

        {cleanValues.map((item) => {
          const width = clampPercent((item.value / scaleMax) * 100);
          const isAboveTarget = target ? item.value > target.max : false;
          const isBelowTarget = target ? item.value < target.min : false;
          const tone = isAboveTarget ? 'orange' : 'blue';

          return (
            <ChartBar
              key={item.label}
              label={item.label}
              value={`${Math.round(item.value)} ${unit}`}
              width={width}
              tone={isBelowTarget ? 'muted' : tone}
            />
          );
        })}
      </div>
    </div>
  );
}

function getExecutionSummary({
  activity,
  plannedSession,
  powerTarget,
}: {
  activity: StravaActivity;
  plannedSession?: Props['plannedSession'];
  powerTarget: Range | null;
}) {
  const durationDelta = formatDeltaMinutes(plannedSession?.duration ?? null, activity.moving_time);
  const weightedPower = activity.weighted_average_watts ?? activity.average_watts ?? null;
  const isPowerHigh = Boolean(powerTarget && isFiniteNumber(weightedPower) && weightedPower > powerTarget.max);
  const isPowerLow = Boolean(powerTarget && isFiniteNumber(weightedPower) && weightedPower < powerTarget.min);
  const isLong = isFiniteNumber(durationDelta) && durationDelta >= 10;
  const isShort = isFiniteNumber(durationDelta) && durationDelta <= -10;

  if (isPowerHigh) {
    return {
      title: 'A little hotter than planned',
      body: `Power drifted above the prescribed range${isLong ? ' and the session ran long' : ''}. Good work, but treat the next easy session as actually easy.`,
    };
  }

  if (isPowerLow || isShort) {
    return {
      title: 'Lighter than planned',
      body: 'You got the session done, but the completed effort came in under the prescription. Do not force missed volume into tomorrow.',
    };
  }

  if (isLong) {
    return {
      title: 'Slightly longer than planned',
      body: 'Effort looks controlled, but the session ran longer than prescribed. That adds a little extra fatigue to the week.',
    };
  }

  return {
    title: 'Effort matched the plan',
    body: 'The completed activity lines up well with the prescribed session. Keep stacking these controlled executions.',
  };
}

function EffortCharts({ activity, sportType, plannedSession }: Pick<Props, 'activity' | 'sportType' | 'plannedSession'>) {
  if (!activity) return null;

  const sport = String(sportType || activity.sport_type || '').toLowerCase();
  const prescriptionText = getPrescriptionText(plannedSession);
  const powerTarget = sport.includes('ride') || sport.includes('bike') ? parsePowerTarget(prescriptionText) : null;
  const heartRateTarget = parseHeartRateTarget(prescriptionText);
  const summary = getExecutionSummary({ activity, plannedSession, powerTarget });
  const hasPower = isFiniteNumber(activity.average_watts) || isFiniteNumber(activity.weighted_average_watts);
  const hasHeartRate = isFiniteNumber(activity.average_heartrate) || isFiniteNumber(activity.max_heartrate);

  if (!plannedSession?.duration && !hasPower && !hasHeartRate) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[#D7DDFF] bg-[#F7FAFF] p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2563FF]">Effort analysis</div>
      <div className="mt-1 text-[18px] font-black tracking-[-0.04em] text-zinc-950">{summary.title}</div>
      <p className="mt-1.5 text-[13px] leading-5 text-zinc-600">{summary.body}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DurationBars plannedMinutes={plannedSession?.duration ?? null} actualSeconds={activity.moving_time} />
        {hasPower ? (
          <TargetBandChart
            title="Power"
            target={powerTarget}
            unit="W"
            values={[
              { label: 'Avg watts', value: activity.average_watts },
              { label: 'Weighted watts', value: activity.weighted_average_watts },
            ]}
          />
        ) : null}
        {hasHeartRate ? (
          <TargetBandChart
            title="Heart rate"
            target={heartRateTarget}
            unit="bpm"
            values={[
              { label: 'Avg HR', value: activity.average_heartrate },
              { label: 'Max HR', value: activity.max_heartrate },
            ]}
          />
        ) : null}
      </div>
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

      <EffortCharts activity={activity} sportType={sportType} plannedSession={plannedSession} />

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
