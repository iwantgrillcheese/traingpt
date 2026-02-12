'use client';

import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

type RaceHubCardProps = {
  raceName?: string | null;
  raceLocation?: string | null;
  raceType?: string | null;
  raceDate?: string | null;
  currentPhase?: string | null;
  readinessLabel?: string;
  readinessScore?: number | null;
  raceHubHref?: string;
  saving?: boolean;
  onSave?: (next: {
    raceType: string;
    raceDate: string;
    raceName?: string;
    raceLocation?: string;
  }) => Promise<{ ok: boolean; message?: string }>;
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
  raceLocation,
  raceType,
  raceDate,
  currentPhase,
  readinessLabel = 'Readiness coming soon',
  readinessScore = null,
  raceHubHref,
  saving = false,
  onSave,
}: RaceHubCardProps) {
  const [open, setOpen] = useState(false);
  const [draftRaceType, setDraftRaceType] = useState(raceType?.trim() || '');
  const [draftRaceDate, setDraftRaceDate] = useState(raceDate?.trim() || '');
  const [draftRaceName, setDraftRaceName] = useState(raceName?.trim() || '');
  const [draftRaceLocation, setDraftRaceLocation] = useState(raceLocation?.trim() || '');
  const [inlineStatus, setInlineStatus] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const title = raceName?.trim() || raceType?.trim() || 'Set your target race';
  const hasRaceSet = Boolean(raceType?.trim() && raceDate?.trim());

  const raceTypeOptions = useMemo(
    () => ['5K', '10K', 'Half Marathon', 'Marathon', 'Sprint Triathlon', 'Olympic Triathlon', '70.3', 'Ironman', 'Custom'],
    []
  );

  const openEditor = () => {
    setDraftRaceType(raceType?.trim() || '');
    setDraftRaceDate(raceDate?.trim() || '');
    setDraftRaceName(raceName?.trim() || '');
    setDraftRaceLocation(raceLocation?.trim() || '');
    setInlineStatus(null);
    setInlineError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!onSave) return;

    if (!draftRaceType || !draftRaceDate) {
      setInlineError('Race type and race date are required.');
      return;
    }

    setInlineError(null);
    const result = await onSave({
      raceType: draftRaceType,
      raceDate: draftRaceDate,
      raceName: draftRaceName,
      raceLocation: draftRaceLocation,
    });

    if (!result.ok) {
      setInlineError(result.message || 'Could not save race details.');
      return;
    }

    setInlineStatus(result.message || 'Saved');
    setOpen(false);
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Race Hub</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{formatRaceDate(raceDate)}</p>
          {!hasRaceSet && <p className="mt-2 text-sm font-medium text-amber-700">Set your target race</p>}
          {inlineStatus && <p className="mt-2 text-sm font-medium text-emerald-700">{inlineStatus}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
            {getCountdownLabel(raceDate)}
          </div>
          <button
            type="button"
            onClick={openEditor}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {hasRaceSet ? 'Edit' : 'Set race'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Current phase</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{currentPhase || 'Phase loading...'}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-500">
            Readiness
            <span
              title="Score based on adherence, consistency, and race proximity."
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500"
            >
              i
            </span>
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {readinessScore != null ? `${readinessScore}/100 · ${readinessLabel}` : readinessLabel}
          </p>
        </div>
      </div>

      {raceHubHref && (
        <div className="mt-4">
          <a
            href={raceHubHref}
            className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Race Prep
          </a>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Edit target race</h3>
            <p className="mt-1 text-sm text-gray-600">Update your race details for planning and countdown.</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Race type</span>
                <select
                  value={raceTypeOptions.includes(draftRaceType) ? draftRaceType : 'Custom'}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraftRaceType(next === 'Custom' ? '' : next);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {raceTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {(!raceTypeOptions.includes(draftRaceType) || draftRaceType === '') && (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Custom race type</span>
                  <input
                    value={draftRaceType}
                    onChange={(e) => setDraftRaceType(e.target.value)}
                    placeholder="e.g. Trail 50K"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Race date</span>
                <input
                  type="date"
                  value={draftRaceDate}
                  onChange={(e) => setDraftRaceDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Race name (optional)</span>
                <input
                  value={draftRaceName}
                  onChange={(e) => setDraftRaceName(e.target.value)}
                  placeholder="e.g. LA Marathon"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Location (optional)</span>
                <input
                  value={draftRaceLocation}
                  onChange={(e) => setDraftRaceLocation(e.target.value)}
                  placeholder="e.g. Los Angeles, CA"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              {inlineError && <p className="text-sm font-medium text-red-600">{inlineError}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
