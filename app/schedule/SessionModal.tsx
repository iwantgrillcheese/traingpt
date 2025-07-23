'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  session: Session | null;
  stravaActivity?: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: (updated: Session) => void;
};

export default function SessionModal({
  session,
  stravaActivity,
  open,
  onClose,
  onUpdate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.structured_workout || null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);

    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        title: session.title,
        sport: session.sport,
        date: session.date,
      }),
    });

    const { details } = await res.json();

    await supabase
      .from('sessions')
      .update({ structured_workout: details })
      .eq('id', session.id);

    setOutput(details);
    onUpdate?.({ ...session, structured_workout: details });
    setLoading(false);
  };

  const handleMarkAsDone = async () => {
    if (!session) return;

    setMarkingComplete(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Not logged in');
      setMarkingComplete(false);
      return;
    }

    const { error } = await supabase.from('completed_sessions').upsert({
      user_id: user.id,
      session_date: session.date,
      session_title: session.title,
      completed_at: new Date().toISOString(),
      source: 'manual',
    });

    if (!error) {
      setIsCompleted(true);
    } else {
      console.error('Error marking session as done:', error.message);
    }

    setMarkingComplete(false);
  };

  if (!session) return null;

  const formattedDate = format(new Date(session.date), 'EEE, MMM d');

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-6 animate-fade-in">
          {/* Title */}
          <div>
            <Dialog.Title className="text-xl font-semibold text-zinc-900">
              {session.title}
            </Dialog.Title>
            <p className="text-sm text-zinc-500 mt-1">
              {formattedDate} • {session.sport}
            </p>
          </div>

          {/* Planned Workout */}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-zinc-600">📋 Detailed Workout</h4>
            <div className="bg-zinc-100 text-sm rounded-md p-3 whitespace-pre-wrap min-h-[80px]">
              {loading ? 'Generating...' : output || 'No details generated yet.'}
            </div>
          </div>

          {/* Optional Strava Metrics */}
          {stravaActivity && (
            <div className="grid grid-cols-2 gap-4 rounded-md bg-zinc-100 p-4 text-sm">
              {stravaActivity.distance && (
                <Metric
                  label="Distance"
                  value={`${(stravaActivity.distance / 1000).toFixed(1)} km`}
                />
              )}
              {stravaActivity.moving_time && stravaActivity.distance && (
                <Metric
                  label="Avg Pace"
                  value={`${formatPace(stravaActivity.distance, stravaActivity.moving_time)} /km`}
                />
              )}
              {stravaActivity.average_heartrate && (
                <Metric
                  label="Heart Rate"
                  value={`${Math.round(stravaActivity.average_heartrate)} bpm`}
                />
              )}
              {stravaActivity.average_watts && (
                <Metric
                  label="Power"
                  value={`${Math.round(stravaActivity.average_watts)} watts`}
                />
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-zinc-400">Generated using TrainGPT</p>
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-black text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Detailed Workout'}
              </button>
              <button
                onClick={handleMarkAsDone}
                disabled={markingComplete || isCompleted}
                className={clsx(
                  'text-sm px-4 py-2 rounded-md border',
                  isCompleted
                    ? 'text-green-700 border-green-300 bg-green-50 cursor-default'
                    : 'text-zinc-700 hover:text-black border-zinc-300'
                )}
              >
                {isCompleted ? 'Marked as Done ✓' : markingComplete ? 'Saving...' : 'Mark as Done'}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-zinc-500 hover:text-black underline"
              >
                Close
              </button>
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
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function formatPace(distanceMeters: number, timeSeconds: number) {
  const paceSecPerKm = timeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
