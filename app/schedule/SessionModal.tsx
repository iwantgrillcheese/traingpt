'use client';

import { Dialog } from '@headlessui/react';

type Props = {
  session: {
    title: string;
    date: string;
    aiWorkout?: string | null;
    status?: string;
  };
  onClose: () => void;
  onGenerateWorkout: () => void;
};

export function SessionModal({ session, onClose, onGenerateWorkout }: Props) {
  if (!session) return null;

  return (
    <Dialog open={!!session} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <Dialog.Panel className="relative z-50 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-2 text-xs text-gray-400 uppercase tracking-wide">{session.date}</div>
        <h2 className="text-lg font-semibold text-neutral-800 mb-2">{session.title}</h2>

        {session.aiWorkout ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200 mb-4">
            {session.aiWorkout}
          </pre>
        ) : (
          <div className="text-sm text-gray-500 italic mb-4">
            No detailed workout yet. Generate one below.
          </div>
        )}

        <div className="flex justify-between items-center mt-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-black transition"
          >
            Close
          </button>

          <button
            onClick={onGenerateWorkout}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
          >
            Generate Detailed Workout
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
