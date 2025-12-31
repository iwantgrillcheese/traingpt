'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

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

export default function SessionModal({
  session,
  stravaActivity,
  open,
  onClose,
  completedSessions,
  onCompletedUpdate,
}: Props) {
  const isMobile = useIsMobile(768);

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.structured_workout || null);
  const [markingComplete, setMarkingComplete] = useState(false);

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

  // Panel variants:
  // - Desktop: centered modal
  // - Mobile: bottom sheet at ~70% height
  const panelClass = isMobile
    ? 'w-full max-w-none rounded-t-3xl bg-white shadow-2xl'
    : 'w-full max-w-2xl rounded-2xl bg-white shadow-2xl';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

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
              ? {
                  height: '70vh',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }
              : undefined
          }
        >
          {/* Sheet handle (mobile) */}
          {isMobile && (
            <div className="pt-3 pb-2 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>
          )}

          <div className={clsx(isMobile ? 'px-5 pb-5' : 'p-6', 'h-full flex flex-col')}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="text-[18px] font-semibold tracking-tight text-zinc-900 truncate">
                  {session.title}
                </Dialog.Title>
                <p className="text-[13px] text-zinc-500 mt-1">
                  {formattedDate} • {session.sport}
                  {isCompleted ? ' • Completed' : ''}
                </p>
              </div>

              <button
                onClick={onClose}
                className="shrink-0 text-[13px] text-zinc-500 hover:text-zinc-900"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="mt-5 space-y-4 overflow-auto pr-1">
              {/* Detailed workout */}
              <div className="rounded-2xl border border-black/5 bg-[#f6f6f4] p-4">
                <div className="text-[12px] font-semibold text-zinc-700 mb-2">
                  Detailed workout
                </div>
                <div className="text-[13px] leading-relaxed text-zinc-900 whitespace-pre-wrap min-h-[80px]">
                  {loading ? 'Generating…' : output || 'No details generated yet.'}
                </div>
              </div>

              {/* Metrics */}
              {stravaActivity && (
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-[12px] font-semibold text-zinc-700 mb-3">
                    Completed metrics
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                      <Metric label="Heart rate" value={`${Math.round(stravaActivity.average_heartrate)} bpm`} />
                    )}
                    {stravaActivity.average_watts != null && (
                      <Metric label="Power" value={`${Math.round(stravaActivity.average_watts)} w`} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions (mobile: stacked, desktop: inline) */}
            <div className={clsx('mt-5 pt-4 border-t border-black/5', isMobile ? '' : '')}>
              <div className={clsx(isMobile ? 'grid gap-3' : 'flex items-center justify-between gap-3')}>
                <div className="text-[11px] text-zinc-400">
                  Generated using TrainGPT
                </div>

                <div className={clsx(isMobile ? 'grid gap-3' : 'flex gap-3')}>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-4 py-3 disabled:opacity-50"
                  >
                    {loading ? 'Generating…' : 'Generate detailed workout'}
                  </button>

                  <button
                    onClick={handleMarkAsDone}
                    disabled={markingComplete}
                    className={clsx(
                      'w-full rounded-xl border text-[13px] font-semibold px-4 py-3',
                      isCompleted
                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                        : 'border-black/10 text-zinc-800 bg-white'
                    )}
                  >
                    {markingComplete ? 'Saving…' : isCompleted ? 'Undo completion' : 'Mark as done'}
                  </button>
                </div>
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
      <p className="text-[11px] text-zinc-500 mb-1">{label}</p>
      <p className="text-[14px] font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function formatPace(distanceMeters: number, timeSeconds: number) {
  const paceSecPerKm = timeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
