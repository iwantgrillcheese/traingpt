'use client';

import { useState } from 'react';
import { format } from 'date-fns';

export default function SessionModal({
  session,
  onClose,
}: {
  session: any;
  onClose: () => void;
}) {
  const [detailedWorkout, setDetailedWorkout] = useState(session?.detailed || '');
  const [loading, setLoading] = useState(false);

  async function handleGenerateDetail() {
    setLoading(true);
    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.id,
        date: session.date,
        title: session.title,
      }),
    });

    const data = await res.json();
    setDetailedWorkout(data?.detail);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white max-w-md w-full rounded-xl p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>

        <div className="mb-4">
          <div className="text-xs text-gray-500">{format(new Date(session.date), 'EEEE, MMM d')}</div>
          <h2 className="text-lg font-semibold text-gray-800">{session.title}</h2>
        </div>

        {detailedWorkout ? (
          <pre className="bg-gray-50 rounded-md p-3 text-sm whitespace-pre-wrap text-gray-800 border">
            {detailedWorkout}
          </pre>
        ) : (
          <button
            onClick={handleGenerateDetail}
            className="bg-black text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Detailed Workout'}
          </button>
        )}
      </div>
    </div>
  );
}
