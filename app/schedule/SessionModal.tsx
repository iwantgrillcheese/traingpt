'use client';

import { useEffect, useState } from 'react';
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

  const { date, title, userNote, status } = session;

  const handleGenerate = async () => {
    setLoading(true);
    await onGenerateWorkout(); // should update outer state, which gets passed back in
    setLoading(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black">×</button>
        </div>

        <p className="text-sm text-neutral-500 mb-3">{new Date(date).toDateString()}</p>

        {!workout && (
  <button
    onClick={onGenerateWorkout}
    disabled={loading}
    className="mb-4 px-4 py-2 text-sm rounded-full border border-neutral-300 hover:bg-neutral-100 transition flex items-center gap-2"
  >
    🪄 {loading ? 'Generating...' : 'Generate Detailed Workout'}
  </button>
)}

{/* Detailed Workout Output */}
{workout && (
  <div className="mb-4 px-4 py-3 border border-neutral-200 rounded-lg bg-neutral-50 whitespace-pre-wrap text-sm text-gray-800">
    {workout}
  </div>
)}

        <textarea
          className="w-full border border-neutral-300 rounded-md p-2 text-sm mb-4"
          placeholder="Leave a note..."
          defaultValue={userNote}
          rows={3}
        />

        <div className="flex justify-end gap-3">
          <button className="text-sm text-gray-500 hover:text-black">Skip</button>
          <button className="bg-black text-white text-sm px-4 py-2 rounded-lg">Mark Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
