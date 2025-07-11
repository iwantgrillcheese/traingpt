'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SessionCardExpanded from './SessionCardExpanded';

interface SessionModalProps {
  session: {
    date: string;
    title: string;
    status?: string;
    aiWorkout?: string;
    userNote?: string;
  };
  onClose: () => void;
  onGenerateWorkout: () => Promise<void>;
}

export function SessionModal({ session, onClose, onGenerateWorkout }: SessionModalProps) {
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] = useState(session.aiWorkout || '');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-detailed-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: session.title, date: session.date }),
      });
      const data = await res.json();
      setWorkout(data.workout);
    } catch (err) {
      console.error('Failed to generate workout', err);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">{session.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black text-xl">
            ×
          </button>
        </div>

        <p className="text-sm text-neutral-500 mb-4">
          {new Date(session.date).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        {!workout && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mb-5 px-4 py-2 text-sm rounded-full border border-neutral-300 hover:bg-neutral-100 transition flex items-center gap-2"
          >
            🪄 {loading ? 'Generating...' : 'Generate Detailed Workout'}
          </button>
        )}

        {workout && (
          <div className="text-sm text-neutral-800 whitespace-pre-wrap space-y-3 mb-5">
            {workout.split('\n').map((line, i) => {
              const trimmed = line.trim();

              if (trimmed.startsWith('- ')) {
                return (
                  <li key={i} className="ml-6 list-disc">
                    {trimmed.replace('- ', '')}
                  </li>
                );
              }

              if (/^\*\*(.+)\*\*$/.test(trimmed)) {
                const section = trimmed.replace(/\*\*/g, '');
                return (
                  <div
                    key={i}
                    className="text-[13px] font-semibold text-gray-800 mt-4 mb-1"
                  >
                    {section}
                  </div>
                );
              }

              if (trimmed === '') return <br key={i} />;

              return (
                <p key={i} className="text-sm text-gray-700">
                  {trimmed}
                </p>
              );
            })}
          </div>
        )}

        <textarea
          className="w-full border border-neutral-300 rounded-md p-2 text-sm mb-4"
          placeholder="Leave a note..."
          defaultValue={session.userNote}
          rows={3}
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-black"
          >
            Skip
          </button>
          <button className="bg-black text-white text-sm px-4 py-2 rounded-lg">
            Mark Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
