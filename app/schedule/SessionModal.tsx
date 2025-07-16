import React, { useState } from 'react';

export default function SessionModal({
  session,
  onClose,
  onStatusChange,
  initialStatus,
  onGenerateWorkout,  // <-- add this here
}: {
  session: {
    title: string;
    date: string;
  } | null;
  onClose: () => void;
  onStatusChange?: (newStatus: 'done' | 'skipped' | 'missed') => void;
  initialStatus?: 'done' | 'skipped' | 'missed' | null;
  onGenerateWorkout?: () => void;  // <-- add type for this
}) {
  const [status, setStatus] = useState(initialStatus || null);

  if (!session) return null;

  const handleStatusChange = (newStatus: 'done' | 'skipped' | 'missed') => {
    setStatus(newStatus);
    if (onStatusChange) onStatusChange(newStatus);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">{session.title}</h2>
        <p className="mb-6">Date: {session.date}</p>

        <div className="flex gap-4 mb-6">
          {['done', 'skipped', 'missed'].map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s as 'done' | 'skipped' | 'missed')}
              className={`px-4 py-2 rounded ${
                status === s
                  ? s === 'done'
                    ? 'bg-green-500 text-white'
                    : s === 'skipped'
                    ? 'bg-gray-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {onGenerateWorkout && (
          <button
            onClick={onGenerateWorkout}
            className="mb-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Generate Detailed Workout
          </button>
        )}

        <button
          onClick={onClose}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-900 w-full"
        >
          Close
        </button>
      </div>
    </div>
  );
}
