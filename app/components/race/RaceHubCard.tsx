'use client';

import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

type RaceHubCardProps = {
  raceName?: string | null;
  raceType?: string | null;
  raceDate?: string | null;
  currentPhase?: string | null;
  readinessLabel?: string;
};

function formatRaceDate(raceDate?: string | null) {
  if (!raceDate) return 'Date not set';
  const parsed = parseISO(raceDate);
  if (!isValid(parsed)) return 'Date not set';
  return format(parsed, 'EEE, MMM d, yyyy');
}

function getCountdownLabel(raceDate?: string | null) {
  if (!raceDate) return 'Countdown unavailable';
  const parsed = parseISO(raceDate);
  if (!isValid(parsed)) return 'Countdown unavailable';

  const days = differenceInCalendarDays(parsed, new Date());

  if (days > 1) return `${days} days to race`;
  if (days === 1) return '1 day to race';
  if (days === 0) return 'Race day';
  if (days === -1) return 'Race was yesterday';
  return `${Math.abs(days)} days since race`;
}

export default function RaceHubCard({
  raceName,
  raceType,
  raceDate,
  currentPhase,
  readinessLabel = 'Readiness coming soon',
}: RaceHubCardProps) {
  const title = raceName?.trim() || raceType?.trim() || 'Race goal not set';

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Race Hub</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{formatRaceDate(raceDate)}</p>
        </div>

        <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
          {getCountdownLabel(raceDate)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Current phase</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{currentPhase || 'Phase loading...'}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Readiness</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{readinessLabel}</p>
        </div>
      </div>
    </section>
  );
}
