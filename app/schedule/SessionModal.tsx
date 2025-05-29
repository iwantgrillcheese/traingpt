'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SessionModalProps {
  session: {
    date: string;
    title: string;
    status?: string;
    aiWorkout?: string;
    userNote?: string;
  };
  onClose: () => void;
}

export function SessionModal({ session, onClose }: SessionModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const { date, title, aiWorkout, userNote, status } = session;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>

        <div className="text-sm text-gray-600">{new Date(date).toDateString()} • {status ?? 'Planned'}</div>

        {aiWorkout ? (
          <div className="space-y-1 text-sm">
            {aiWorkout.split('\n').map((line, i) => (
              <p key={i}>• {line}</p>
            ))}
          </div>
        ) : (
          <button
            onClick={() => {
              window.location.href = `/coaching?q=${encodeURIComponent(`Can you generate a detailed workout for "${title}" on ${date}?`)}`;
            }}
            className="text-blue-600 underline text-sm"
          >
            Ask your coach for a detailed workout →
          </button>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Your Notes</label>
          <textarea
            className="w-full border rounded p-2 text-sm"
            placeholder="Write how it went, what you changed, etc..."
            defaultValue={userNote}
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-3 text-sm">
          <button className="text-green-600 hover:underline">✓ Mark as Done</button>
          <button className="text-gray-500 hover:underline">Skip</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
