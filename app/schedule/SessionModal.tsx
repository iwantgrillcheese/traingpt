'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase-client';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import {
  loadFuelingPreferences,
  saveFuelingPreferences,
} from '@/lib/fueling-preferences';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  session: Session | null;
  stravaActivity?: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  completedSessions: CompletedSession[];
  onCompletedUpdate: (updated: CompletedSession[]) => void;
  onSessionDeleted?: (sessionId: string) => void;
};

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [breakpointPx]);

  return isMobile;
}

function toStravaIdString(
  session: Session | null,
  stravaActivity?: StravaActivity | null
): string | undefined {
  const fromActivity = (stravaActivity as any)?.strava_id ?? (stravaActivity as any)?.id;
  if (fromActivity != null) return String(fromActivity);

  const fromSession = (session as any)?.strava_id;
  if (fromSession != null && String(fromSession).trim() !== '') return String(fromSession);

  return undefined;
}

/**
 * Turn "ChatGPT-shaped" structured_workout into a strict UI schema.
 * Supports either:
 *  - Section headings like "Warmup:" / "Main Set:" / "Cooldown:"
 *  - Markdown-ish "**Warmup:**"
 *  - Bullets "- " or "• "
 */
function parseWorkout(raw: string | null): Array<{ title: string; items: string[] }> {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  const cleanHeading = (s: string) =>
    s
      .replace(/^\*\*/g, '')
      .replace(/\*\*$/g, '')
      .replace(/[:：]\s*$/g, '')
      .trim();

  const isHeading = (l: string) => {
    // Examples:
    // "Warmup:" , "**Warmup:**", "Main Set:", "Cooldown:", "Notes:"
    const t = l.replace(/\*\*/g, '').trim().toLowerCase();
    if (t.endsWith(':') || t.endsWith('：')) {
      const base = t.replace(/[:：]$/g, '');
      return [
        'warmup',
        'main set',
        'cooldown',
        'notes',
        'optional',
        'recovery',
        'drills',
        'fueling',
      ].includes(base);
    }
    return false;
  };

  const normalizeBullet = (l: string) => l.replace(/^[-•]\s*/, '').trim();

  for (const line of lines) {
    if (isHeading(line)) {
      const title = cleanHeading(line);
      current = { title, items: [] };
      sections.push(current);
      continue;
    }

    const isBullet = /^[-•]\s+/.test(line);
    if (!current) {
      // Create a default section if the model didn't provide headings.
      current = { title: 'Workout', items: [] };
      sections.push(current);
    }

    if (isBullet) {
      current.items.push(normalizeBullet(line));
    } else {
      // Treat non-bullets as a bullet item to enforce consistent UI.
      current.items.push(line.replace(/\*\*/g, '').trim());
    }
  }

  // Strip "Workout Title:" lines into the header (don’t show inside body)
  const filtered = sections.map((s) => ({
    ...s,
    items: s.items.filter((it) => !/^workout title/i.test(it)),
  }));

  // Remove empty sections
  return filtered.filter((s) => s.items.length > 0);
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7 7l10 10M17 7L7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getSportTheme(sportRaw?: string | null) {
  const sport = String(sportRaw ?? '')
    .trim()
    .toLowerCase();

  switch (sport) {
    case 'swim':
      return {
        gradient: 'from-slate-600/90 to-sky-500/80',
        softBg: 'bg-slate-50',
        softBorder: 'border-slate-200',
      };
    case 'bike':
      return {
        gradient: 'from-zinc-700/90 to-zinc-500/80',
        softBg: 'bg-zinc-50',
        softBorder: 'border-zinc-200',
      };
    case 'run':
      return {
        gradient: 'from-emerald-700/90 to-teal-500/80',
        softBg: 'bg-emerald-50/60',
        softBorder: 'border-emerald-200',
      };
    case 'strength':
      return {
        gradient: 'from-violet-700/90 to-fuchsia-500/75',
        softBg: 'bg-violet-50/60',
        softBorder: 'border-violet-200',
      };
    case 'rest':
      return {
        gradient: 'from-zinc-500/90 to-zinc-400/80',
        softBg: 'bg-zinc-50',
        softBorder: 'border-zinc-200',
      };
    default:
      return {
        gradient: 'from-zinc-700/90 to-slate-500/80',
        softBg: 'bg-zinc-50',
        softBorder: 'border-zinc-200',
      };
  }
}

export default function SessionModal({
  session,
  stravaActivity,
  open,
  onClose,
  completedSessions,
  onCompletedUpdate,
  onSessionDeleted,
}: Props) {
  const isMobile = useIsMobile(768);

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.structured_workout || null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [fuelingEnabled, setFuelingEnabled] = useState(false);
  const [bodyWeightKg, setBodyWeightKg] = useState<string>('');
  const [bodyFatPct, setBodyFatPct] = useState<string>('');
  const [sweatRateLPerHour, setSweatRateLPerHour] = useState<string>('');

  const isCompleted = useMemo(
    () =>
      completedSessions.some(
        (s) => s.date === session?.date && s.session_title === session?.title
      ),
    [completedSessions, session?.date, session?.title]
  );

  useEffect(() => {
    setOutput(session?.structured_workout || null);
  }, [session?.id]);

  useEffect(() => {
    const defaults = loadFuelingPreferences();
    setFuelingEnabled(defaults.enabled);
    setBodyWeightKg(defaults.bodyWeightKg);
    setBodyFatPct(defaults.bodyFatPct);
    setSweatRateLPerHour(defaults.sweatRateLPerHour);
  }, [session?.id]);

  useEffect(() => {
    saveFuelingPreferences({
      enabled: fuelingEnabled,
      bodyWeightKg,
      bodyFatPct,
      sweatRateLPerHour,
    });
  }, [fuelingEnabled, bodyWeightKg, bodyFatPct, sweatRateLPerHour]);

  const parsedWorkout = useMemo(() => parseWorkout(output), [output]);

  const isUserCreatedSession = useMemo(() => {
    if (!session) return false;

    const hasStructuredData = Boolean(session.structured_workout || session.details);
    const hasStravaLink = Boolean(session.strava_id || stravaActivity);
    const sportValue = String((session as any).sport ?? '')
      .trim()
      .toLowerCase();
    const looksLikeManualTitle = /^session\s/i.test(session.title || '');

    return (
      !hasStructuredData &&
      !hasStravaLink &&
      (sportValue === '' || sportValue === 'other' || looksLikeManualTitle)
    );
  }, [session, stravaActivity]);

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);

    try {
      const res = await fetch('/api/generate-detailed-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          title: session.title,
          sport: session.sport,
          date: session.date,
          details: session.details ?? '',
          fueling: {
            enabled: fuelingEnabled,
            bodyWeightKg: bodyWeightKg ? Number(bodyWeightKg) : null,
            bodyFatPct: bodyFatPct ? Number(bodyFatPct) : null,
            workoutDurationMin:
              typeof session.duration === 'number' && Number.isFinite(session.duration)
                ? Math.round(session.duration)
                : null,
            sweatRateLPerHour: sweatRateLPerHour ? Number(sweatRateLPerHour) : null,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        console.error('Generate detailed failed:', data);
        alert(data?.error || 'Failed to generate detailed workout.');
        return;
      }

      const structured = (data?.structured_workout ?? '').trim();
      if (!structured) {
        console.error('Generate detailed returned empty structured_workout:', data);
        alert('No workout details returned.');
        return;
      }

      setOutput(structured);
    } catch (err) {
      console.error(err);
      alert('Unexpected error generating workout.');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteSession = async () => {
    if (!session || !isUserCreatedSession) return;

    const confirmed = window.confirm('Delete this session from your calendar?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('sessions').delete().eq('id', session.id);

      if (error) {
        console.error('Failed to delete session:', error);
        alert('Failed to delete session. Please try again.');
        return;
      }

      onSessionDeleted?.(session.id);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Unexpected error deleting session.');
    }
  };

  const handleMarkAsDone = async () => {
    if (!session) return;
    setMarkingComplete(true);

    try {
      const res = await fetch('/api/schedule/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_date: session.date,
          session_title: session.title,
          undo: isCompleted,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        console.error('Failed to mark done:', msg);
        alert('Failed to update session status.');
        return;
      }

      const newEntry: CompletedSession = {
        date: session.date,
        session_title: session.title,
        strava_id: toStravaIdString(session, stravaActivity),
      };

      const newCompletedList: CompletedSession[] = isCompleted
        ? completedSessions.filter(
            (s) => s.date !== session.date || s.session_title !== session.title
          )
        : [...completedSessions, newEntry];

      onCompletedUpdate(newCompletedList);
    } catch (err) {
      console.error(err);
      alert('Unexpected error updating session.');
    } finally {
      setMarkingComplete(false);
    }
  };

  if (!session) return null;

  const formattedDate = format(parseISO(session.date), 'EEE, MMM d');
  const sportTheme = getSportTheme(session.sport);
  const plannedDuration =
    typeof session.duration === 'number' && Number.isFinite(session.duration)
      ? `${Math.round(session.duration)} min`
      : null;

  const panelClass = isMobile
    ? 'w-full max-w-none rounded-t-3xl border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.4)]'
    : 'w-full max-w-3xl rounded-3xl border border-black/10 bg-white shadow-[0_35px_100px_rgba(0,0,0,0.38)]';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" aria-hidden="true" />

      <div
        className={clsx(
          'fixed inset-0 flex',
          isMobile ? 'items-end justify-center' : 'items-center justify-center'
        )}
      >
        <Dialog.Panel
          className={panelClass}
          style={
            isMobile
              ? { height: '72vh', paddingBottom: 'env(safe-area-inset-bottom)' }
              : undefined
          }
        >
          {isMobile && (
            <div className="pt-3 pb-2 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>
          )}

          <div className={clsx(isMobile ? 'px-5 pb-5' : 'p-7', 'h-full flex flex-col')}>
            {/* Header */}
            <div
              className={clsx(
                'rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 text-white',
                'bg-gradient-to-r',
                sportTheme.gradient,
                sportTheme.softBorder
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Dialog.Title className="text-[22px] font-semibold tracking-tight text-white">
                    {session.title}
                  </Dialog.Title>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/90">
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-semibold">
                      {formattedDate}
                    </span>
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-semibold capitalize">
                      {session.sport}
                    </span>
                    {isCompleted && (
                      <span className="rounded-full border border-white/35 bg-white/15 px-2.5 py-1 font-semibold">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="shrink-0 rounded-full border border-white/25 bg-white/10 p-2 text-white/90 hover:bg-white/20"
                  aria-label="Close"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickStat label="Sport" value={session.sport || '—'} />
                <QuickStat label="Planned" value={plannedDuration ?? '—'} />
                <QuickStat
                  label="Distance"
                  value={
                    stravaActivity?.distance != null
                      ? `${(stravaActivity.distance / 1000).toFixed(1)} km`
                      : '—'
                  }
                />
                <QuickStat
                  label="Duration"
                  value={
                    stravaActivity?.moving_time != null
                      ? `${Math.floor(stravaActivity.moving_time / 60)}m`
                      : '—'
                  }
                />
              </div>
            </div>

            {/* Body */}
            <div className="mt-5 flex-1 overflow-auto pr-1">
              {/* Workout */}
              <div className={clsx('rounded-2xl border bg-white', sportTheme.softBorder)}>
                <div className={clsx('px-4 pt-4 pb-3 border-b', sportTheme.softBorder, sportTheme.softBg)}>
                  <div className="text-[12px] font-semibold tracking-wide text-zinc-500 uppercase">
                    Workout
                  </div>
                </div>

                <div className="px-4 py-4">
                  {loading ? (
                    <div className="space-y-3">
                      <div className="h-4 w-40 rounded bg-black/[0.06]" />
                      <div className="h-3 w-full rounded bg-black/[0.05]" />
                      <div className="h-3 w-5/6 rounded bg-black/[0.05]" />
                      <div className="h-3 w-2/3 rounded bg-black/[0.05]" />
                    </div>
                  ) : parsedWorkout.length ? (
                    <div className="space-y-4">
                      {parsedWorkout.map((sec) => (
                        <div key={sec.title} className="rounded-xl border border-black/5 bg-zinc-50/60 p-3">
                          <div className="text-[14px] font-semibold text-zinc-950">
                            {sec.title}
                          </div>
                          <ul className="mt-2 space-y-2">
                            {sec.items.map((it, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                                <span className="text-[14px] leading-relaxed text-zinc-800">
                                  {it}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-black/[0.03] p-4">
                      <div className="text-[14px] font-semibold text-zinc-900">
                        No detailed workout yet
                      </div>
                      <div className="mt-1 text-[13px] text-zinc-600">
                        Generate a structured version you can execute today.
                      </div>
                    </div>
                  )}

                  {session.details ? (
                    <div className="mt-4 rounded-xl border border-black/5 bg-zinc-50/70 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Session notes
                      </div>
                      <div className="mt-1 text-[13px] leading-relaxed text-zinc-700">{session.details}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Metrics */}
              {stravaActivity && (
                <div className="mt-4 rounded-2xl border border-black/5 bg-white">
                  <div className="px-4 pt-4 pb-3 border-b border-black/5">
                    <div className="text-[12px] font-semibold tracking-wide text-zinc-500 uppercase">
                      Completed
                    </div>
                  </div>

                  <div className="px-4 py-4 grid grid-cols-2 gap-4">
                    {stravaActivity.distance != null && (
                      <Metric
                        label="Distance"
                        value={`${(stravaActivity.distance / 1000).toFixed(1)} km`}
                      />
                    )}
                    {stravaActivity.moving_time != null && stravaActivity.distance != null && (
                      <Metric
                        label="Avg pace"
                        value={`${formatPace(stravaActivity.distance, stravaActivity.moving_time)} /km`}
                      />
                    )}
                    {stravaActivity.average_heartrate != null && (
                      <Metric
                        label="Heart rate"
                        value={`${Math.round(stravaActivity.average_heartrate)} bpm`}
                      />
                    )}
                    {stravaActivity.average_watts != null && (
                      <Metric label="Power" value={`${Math.round(stravaActivity.average_watts)} w`} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-black/5">
              <div className="mb-4 rounded-xl border border-black/10 bg-zinc-50/70 p-4">
                <label className="flex items-center gap-3 text-[14px] text-zinc-800">
                  <input
                    type="checkbox"
                    checked={fuelingEnabled}
                    onChange={(e) => setFuelingEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Add fueling guidance to this workout
                </label>

                {fuelingEnabled ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[12px] text-zinc-600">Body weight (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={bodyWeightKg}
                          onChange={(e) => setBodyWeightKg(e.target.value)}
                          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px]"
                          placeholder="70"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] text-zinc-600">Body fat % (optional)</label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="0.1"
                          value={bodyFatPct}
                          onChange={(e) => setBodyFatPct(e.target.value)}
                          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px]"
                          placeholder="18"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] text-zinc-600">Sweat rate L/hr (optional)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={sweatRateLPerHour}
                          onChange={(e) => setSweatRateLPerHour(e.target.value)}
                          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px]"
                          placeholder="0.8"
                        />
                      </div>
                    </div>

                    <a
                      href="/fueling"
                      className="mt-3 inline-flex text-[12px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
                    >
                      Open fueling shop guide
                    </a>
                  </>
                ) : null}
              </div>

              <div className={clsx(isMobile ? 'grid gap-3' : 'flex items-center gap-3')}>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full rounded-xl bg-zinc-950 text-white text-[14px] font-semibold px-4 py-3 disabled:opacity-50 active:translate-y-[0.5px]"
                >
                  {loading ? 'Generating…' : parsedWorkout.length ? 'Regenerate workout' : 'Generate workout'}
                </button>

                <button
                  onClick={handleMarkAsDone}
                  disabled={markingComplete}
                  className={clsx(
                    'w-full rounded-xl border text-[14px] font-semibold px-4 py-3 active:translate-y-[0.5px]',
                    isCompleted
                      ? 'border-black/10 bg-black/[0.03] text-zinc-900'
                      : 'border-black/10 bg-white text-zinc-900'
                  )}
                >
                  {markingComplete ? 'Saving…' : isCompleted ? 'Undo completion' : 'Mark as done'}
                </button>

                {isUserCreatedSession ? (
                  <button
                    onClick={handleDeleteSession}
                    className="w-full rounded-xl border border-black/10 bg-zinc-100 text-zinc-700 text-[14px] font-semibold px-4 py-3 active:translate-y-[0.5px]"
                  >
                    Delete session
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-zinc-500 uppercase mb-1">{label}</p>
      <p className="text-[16px] font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-white">{value}</div>
    </div>
  );
}

function formatPace(distanceMeters: number, timeSeconds: number) {
  const paceSecPerKm = timeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
