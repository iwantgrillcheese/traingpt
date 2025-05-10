'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';

interface SessionCardProps {
  title: string;
  duration?: string;
  details?: string[];
  date?: string;
  isStravaOnly?: boolean;
  initialStatus?: 'done' | 'skipped' | 'missed';
  onStatusChange?: (status: 'done' | 'skipped' | 'missed') => void;
}

type SessionStatus = 'not_started' | 'done' | 'skipped' | 'missed';

export function SessionCard({
  title,
  duration = '',
  details = [],
  date,
  initialStatus,
  onStatusChange,
  isStravaOnly = false
}: SessionCardProps) {
  const today = startOfDay(new Date());
  const dateObj = date ? parseISO(date) : null;
  const isPast = dateObj ? isBefore(dateObj, today) : false;
  const derivedStatus: SessionStatus =
    initialStatus ?? (isPast ? 'missed' : 'not_started');

  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<SessionStatus>(derivedStatus);

  const dayFormatted = date ? format(parseISO(date), 'EEEE, MMMM d') : '';

  const getBorderColor = () => {
    switch (status) {
      case 'done':
        return 'border-green-500';
      case 'skipped':
        return 'border-gray-400';
      case 'missed':
        return 'border-red-500';
      default:
        return 'border-gray-200';
    }
  };

  return (
    <div
  className={`rounded-2xl border shadow-sm bg-white cursor-pointer overflow-hidden transition-all
    ${getBorderColor()}
    ${isStravaOnly ? 'border-l-4 border-orange-400' : ''}
  `}
  onClick={(e) => {
    if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
      setExpanded(!expanded);
    }
  }}
>
      {/* Collapsed View */}
      <div className="p-4 flex flex-col">
      <div className="text-md font-semibold text-gray-800 flex items-center gap-2">
      {isStravaOnly && (
  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1 w-max">
    From Strava
  </span>
)}
</div>
        {duration && <div className="text-sm text-gray-500 mt-1">{duration}</div>}
        <div className="text-xs text-gray-400 mt-2">{expanded ? 'Tap to collapse' : 'Tap to expand'}</div>
      </div>

      {/* Expanded View */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t px-4 pt-4 pb-6 text-sm text-gray-700"
          >
            {/* Session Details or Message */}
            {details.length > 0 ? (
              <div className="mb-4">
                <div className="font-semibold mb-2">Session Details</div>
                <ul className="list-disc list-inside space-y-1">
                  {details.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-gray-500 text-center mb-4">No full workout loaded yet.</div>
            )}

            {/* Status Buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus('done');
                  onStatusChange?.('done');
                }}
                className={`text-sm px-3 py-1 rounded-full border transition ${
                  status === 'done'
                    ? 'bg-green-100 border-green-600 text-green-800'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                ✓ Completed
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus('skipped');
                  onStatusChange?.('skipped');
                }}
                className={`text-sm px-3 py-1 rounded-full border transition ${
                  status === 'skipped'
                    ? 'bg-gray-100 border-gray-500 text-gray-700'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                ⏭️ Skipped
              </button>
            </div>

            {/* Notes Section */}
            <div className="mb-4">
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                placeholder="Write your notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  console.log('Auto-saving note:', note); // 🔥 hook to backend later
                }}
              />
            </div>

            {/* Ask Coach Button */}
            {date && (
              <div className="flex justify-center">
                <Link
                  href={`/coaching?prefill=${encodeURIComponent(
                    `Hey coach, can you give me a detailed workout for my "${title}" session on ${dayFormatted}?`
                  )}`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-full text-sm hover:bg-blue-50 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  💬 Ask your coach for a detailed workout
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}