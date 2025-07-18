// /app/schedule/SessionModal.tsx
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

    // Save to Supabase
    const supabase = createClientComponentClient();
    await supabase
      .from('sessions')
      .update({ details: output })
      .eq('id', session.id);

    setLoading(false);
  };

  if (!open || !session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-black text-xl"
        >
          ×
        </button>

        <h2 className="text-lg font-semibold mb-2">
          {session.title} – {format(new Date(session.date), 'EEEE, MMM d')}
        </h2>

        {detailedWorkout ? (
          <div className="whitespace-pre-wrap text-sm border rounded-md p-4 bg-gray-50">
            {detailedWorkout}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No detailed workout yet.</p>
        )}

        <button
          onClick={handleGenerateWorkout}
          disabled={loading}
          className="mt-4 w-full bg-black text-white py-2 px-4 rounded disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Detailed Workout'}
        </button>
      </div>
    </div>
  );
}
