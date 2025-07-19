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

  useEffect(() => {
    if (session?.details) setDetailedWorkout(session.details);
  }, [session]);

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
    setDetailedWorkout(output);

    const supabase = createClientComponentClient();
    await supabase.from('sessions').update({ details: output }).eq('id', session.id);

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
          <div className="text-sm text-gray-500">{format(new Date(session.date), 'EEEE, MMMM d')}</div>
          <h2 className="text-lg font-semibold">{session.title}</h2>

          {detailedWorkout ? (
            <div className="whitespace-pre-wrap text-sm bg-gray-50 border rounded-md p-4">
              {detailedWorkout}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No detailed workout yet.</p>
          )}

          <button
            onClick={handleGenerateWorkout}
            disabled={loading}
            className="w-full bg-black text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate Detailed Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}
