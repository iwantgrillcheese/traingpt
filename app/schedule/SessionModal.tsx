'use client';

import React, { useState } from 'react';

export interface SessionModalProps {
  session: {
    title: string;
    date: string;
    aiWorkout?: string | null;
  } | null;
  onClose: () => void;
  onStatusChange?: (newStatus: 'done' | 'skipped' | 'missed') => void;
  onGenerateWorkout?: () => Promise<void>;
}

export function SessionModal({
  session,
  onClose,
  onStatusChange,
  onGenerateWorkout,
}: SessionModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!session) return null;

  const { title, date, aiWorkout } = session;

  const handleGenerate = async () => {
    if (!onGenerateWorkout) return;
    setIsLoading(true);
    try {
      await onGenerateWorkout();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <p className="mb-4">Date: {date}</p>

        {aiWorkout && (
          <pre className="mb-4 whitespace-pre-wrap bg-gray-100 p-3 rounded text-sm">
            {aiWorkout}
          </pre>
        )}

        <div className="flex justify-between gap-2">
          {onStatusChange && (
            <>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded"
                onClick={() => onStatusChange('done')}
              >
                Done
              </button>
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                onClick={() => onStatusChange('skipped')}
              >
                Skipped
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded"
                onClick={() => onStatusChange('missed')}
              >
                Missed
              </button>
            </>
          )}

          {onGenerateWorkout && (
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded ml-auto disabled:opacity-50"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Detailed Workout'}
            </button>
          )}

          <button
            className="bg-black text-white px-4 py-2 rounded ml-auto"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
