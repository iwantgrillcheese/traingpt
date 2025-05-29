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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black">×</button>
        </div>

        <p className="text-sm text-neutral-500 mb-2">{new Date(date).toDateString()}</p>

        {aiWorkout && (
          <div className="text-sm text-neutral-800 whitespace-pre-wrap mb-4">
            {aiWorkout}
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
