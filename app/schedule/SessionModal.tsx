import React, { useState } from 'react';

export type Session = {
  title: string;
  date: string;
  aiWorkout?: string | null;
};

export type SessionModalProps = {
  session: Session;
  onClose: () => void;
  onStatusChange?: (newStatus: 'done' | 'skipped' | 'missed') => void;
  onGenerateWorkout?: () => Promise<void>;
};

export function SessionModal({
  session,
  onClose,
  onStatusChange,
  onGenerateWorkout,
}: SessionModalProps) {
  const { title, date, aiWorkout } = session;
  const [isLoading, setIsLoading] = useState(false);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-medium max-w-md w-full p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 leading-snug text-primary">{title}</h2>
        <p className="text-sm text-primary-light mb-6">Date: {date}</p>

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          {onStatusChange && (
            <>
              <button
                className="bg-accent-swim hover:bg-blue-500 text-white rounded-xl px-5 py-2 shadow-subtle transition"
                onClick={() => onStatusChange('done')}
              >
                Done
              </button>
              <button
                className="bg-background-rest hover:bg-gray-300 text-primary rounded-xl px-5 py-2 shadow-subtle transition"
                onClick={() => onStatusChange('skipped')}
              >
                Skipped
              </button>
              <button
                className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2 shadow-subtle transition"
                onClick={() => onStatusChange('missed')}
              >
                Missed
              </button>
            </>
          )}

          {onGenerateWorkout && (
            <button
              className={`${
                isLoading ? 'bg-blue-400' : 'bg-primary hover:bg-primary/90'
              } text-white rounded-xl px-5 py-2 shadow-subtle transition flex items-center justify-center`}
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading && (
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              Generate Detailed Workout
            </button>
          )}

          <button
            className="bg-primary hover:bg-primary/90 text-white rounded-xl px-5 py-2 shadow-subtle transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {aiWorkout && (
          <pre className="bg-background-light p-4 rounded-xl text-sm whitespace-pre-wrap max-h-48 overflow-y-auto text-primary">
            {aiWorkout}
          </pre>
        )}
      </div>
    </div>
  );
}
