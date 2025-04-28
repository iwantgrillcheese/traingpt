'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

interface SessionCardProps {
  title: string;
  duration?: string; // optional
  details?: string[]; // optional
  date?: string; // ISO string
}

export function SessionCard({ title, duration = '', details = [], date }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  const dayFormatted = date ? format(parseISO(date), 'EEEE, MMMM d') : '';

  return (
    <div
      className="rounded-2xl border shadow-sm bg-white cursor-pointer overflow-hidden transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed View */}
      <div className="p-4 flex flex-col">
        <div className="text-md font-semibold text-gray-800">{title}</div>
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
              <div className="text-gray-500 text-center mb-4">
                No full workout loaded yet.
              </div>
            )}

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
                  href={`/coaching?prefill=${encodeURIComponent(`Hey coach, can you give me a detailed workout for my "${title}" session on ${dayFormatted}?`)}`}
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
