'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Session } from '@/types/session';

export function SessionModal({
  session,
  onClose,
  onGenerateWorkout,
}: {
  session: {
    id: string;
    title: string;
    label: string;
    date: string;
    status: string;
    aiWorkout?: string | null;
    userNote?: string | null;
    structured_workout?: string | null;
  };
  onClose: () => void;
  onGenerateWorkout?: (sessionId: string, workout: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] = useState(session.aiWorkout || '');
  const [note, setNote] = useState(session.userNote || '');
  const [status, setStatus] = useState(session.status || '');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (!session.structured_workout && !workout) {
      (async () => {
        const res = await fetch(`/api/get-session?sessionId=${session.id}`);
        const data = await res.json();
        if (data?.structured_workout) setWorkout(data.structured_workout);
      })();
    }
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-detailed-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: session.label, // use label as title
          date: session.date,
          sessionId: session.id,
        }),
      });

      const data = await res.json();
      if (data?.workout) {
        setWorkout(data.workout);
        onGenerateWorkout?.(session.id, data.workout);
      }
    } catch (err) {
      console.error('Failed to generate workout', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await fetch('/api/session-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, status: newStatus }),
    });
  };

  const saveNote = async () => {
    if (note !== session.userNote) {
      await fetch('/api/session-note', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, note }),
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{session.label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black">×</button>
        </div>

        <p className="text-sm text-neutral-500 mb-3">{new Date(session.date).toDateString()}</p>

        {!workout && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mb-4 px-4 py-2 text-sm rounded-full border border-neutral-300 hover:bg-neutral-100 transition flex items-center gap-2"
          >
            🪄 {loading ? 'Generating...' : 'Generate Detailed Workout'}
          </button>
        )}

        {workout && (
          <div className="text-sm text-neutral-800 whitespace-pre-wrap mb-4 space-y-3">
            {workout.split('\n').map((line, i) => {
              const trimmed = line.trim();

              if (trimmed.startsWith('- ')) {
                return <li key={i} className="ml-6 list-disc">{trimmed.replace('- ', '')}</li>;
              }

              if (/^\*\*(.+)\*\*$/.test(trimmed)) {
                const section = trimmed.replace(/\*\*/g, '');
                return (
                  <div key={i} className="text-[13px] font-semibold text-gray-800 mt-4 mb-1">
                    {section}
                  </div>
                );
              }

              if (trimmed === '') return <br key={i} />;
              return <p key={i} className="text-sm text-gray-700">{trimmed}</p>;
            })}
          </div>
        )}

        <textarea
          className="w-full border border-neutral-300 rounded-md p-2 text-sm mb-4"
          placeholder="Leave a note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          rows={3}
        />

        <div className="flex justify-end gap-3">
          <button
            className="text-sm text-gray-500 hover:text-black"
            onClick={() => updateStatus('skipped')}
          >
            Skip
          </button>
          <button
            className="bg-black text-white text-sm px-4 py-2 rounded-lg"
            onClick={() => updateStatus('done')}
          >
            Mark Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
