'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SessionCardProps {
  title: string;
  duration?: string; // optional
  details?: string[]; // optional
}

export function SessionCard({ title, duration = '', details = [] }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

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
            {/* Session Details */}
            <div className="mb-4">
              <div className="font-semibold mb-2">Session Details</div>
              <ul className="list-disc list-inside space-y-1">
                {details.length > 0 ? (
                  details.map((step, idx) => <li key={idx}>{step}</li>)
                ) : (
                  <>
                    <li>Warm up 10min Zone 1</li>
                    <li>Main set based on session</li>
                    <li>Cool down 5min easy</li>
                  </>
                )}
              </ul>
            </div>

            {/* Notes Section */}
            <div>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                placeholder="Write your notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  console.log('Auto-saving note:', note); // 🔥 Later: Save to Supabase
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
