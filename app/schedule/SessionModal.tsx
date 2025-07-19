'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';
import type { Session } from '@/types/session';

type SessionModalProps = {
  open: boolean;
  onClose: () => void;
  session: Session | null;
};

export default function SessionModal({ open, onClose, session }: SessionModalProps) {
  const [detailedWorkout, setDetailedWorkout] = useState<string | null>(session?.details || null);
  const [loading, setLoading] = useState(false);
  const [stravaData, setStravaData] = useState<any>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (session?.details) setDetailedWorkout(session.details);
  }, [session]);

  // ✅ Fetch Strava activity using `strava_id`
  useEffect(() => {
    const fetchStravaData = async () => {
      if (!session?.strava_id) return;

      const { data, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('id', session.strava_id)
        .single();

      if (data && !error) setStravaData(data);
    };

    fetchStravaData();
  }, [session?.strava_id]);

  const handleGenerateWorkout = async () => {
    if (!session) return;
    setLoading(true);

    const res = await fetch('/api/generate-detailed-workout', {
      method: 'POST',
      body: JSON.stringify({
        title: session.title,
        date: session.date,
        sport: session.sport,
      }),
    });

    const { output } = await res.json();
    await supabase.from('sessions').update({ details: output }).eq('id', session.id);

    setDetailedWorkout(output);
    setLoading(false);
  };

  if (!open || !session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-black text-2xl font-light"
        >
          ×
        </button>

        <div className="p-6 space-y-4">
          {/* Session title and date */}
          <div>
            <h2 className="text-lg font-semibold">{session.title}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(session.date), 'EEEE, MMMM d')}
            </p>
          </div>

          {/* Strava Metrics */}
          {stravaData && (
            <div className="text-sm bg-gray-50 border rounded p-3 space-y-1">
              <p>
                <strong>Distance:</strong>{' '}
                {(stravaData.distance / 1000).toFixed(2)} km
              </p>
              <p>
                <strong>Time:</strong>{' '}
                {Math.floor(stravaData.moving_time / 60)}:
                {String(stravaData.moving_time % 60).padStart(2, '0')} min
              </p>
              {stravaData.average_speed && (
                <p>
                  <strong>Avg Speed:</strong>{' '}
                  {(stravaData.average_speed * 3.6).toFixed(1)} km/h
                </p>
              )}
              {stravaData.average_heartrate && (
                <p>
                  <strong>Avg HR:</strong> {stravaData.average_heartrate} bpm
                </p>
              )}
              {stravaData.average_watts && (
                <p>
                  <strong>Avg Power:</strong> {stravaData.average_watts} W
                </p>
              )}
            </div>
          )}

          {/* GPT Output or Button */}
          {detailedWorkout ? (
            <div className="whitespace-pre-wrap text-sm bg-gray-50 border rounded-md p-4">
              {detailedWorkout}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No detailed workout yet.</p>
          )}

          <button
            onClick={handleGenerateWorkout}
            disabled={loading}
            className="mt-2 w-full bg-black text-white py-2 px-4 rounded text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Detailed Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}
