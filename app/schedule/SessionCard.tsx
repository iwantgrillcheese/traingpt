'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { Session, SessionStatus } from '@/types/session';

type DisplaySession = Session & {
  isStravaOnly?: boolean;
  duration?: number;
};

interface Props {
  session: DisplaySession;
  onStatusChange?: (sessionId: string, newStatus: 'done' | 'skipped' | 'missed') => void;
}

export default function SessionCard({ session, onStatusChange }: Props) {
  const today = startOfDay(new Date());
  const dateObj = parseISO(session.date);
  const isPast = isBefore(dateObj, today);
  const derivedStatus: SessionStatus = session.status ?? (isPast ? 'missed' : 'not_started');

  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<SessionStatus>(derivedStatus);
  const [savingNote, setSavingNote] = useState(false);

  const dayFormatted = format(dateObj, 'EEEE, MMMM d');

  const getBorderColor = () => {
    switch (status) {
      case 'done':
        return 'border-green-500';
      case 'skipped':
        return 'border-gray-400';
      case 'missed':
        return 'border-red-500';
      default:
        return session.isStravaOnly ? 'border-orange-400' : 'border-gray-200';
    }
  };

  const handleChange = async (newStatus: 'done' | 'skipped') => {
    setStatus(newStatus);
    onStatusChange?.(session.id, newStatus);
    await fetch('/api/session-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, status: newStatus }),
    });
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await fetch('/api/session-note', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, note }),
      });
    } catch (err) {
      console.error('Failed to save session note', err);
    } finally {
      setSavingNote(false);
    }
  };

  const structured = session.structured_workout;

  return (
    <div
      className={`rounded-2xl border shadow-sm bg-white cursor-pointer overflow-hidden transition-all ${getBorderColor()} ${session.isStravaOnly ? 'border-l-4' : ''}`}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).tagName !== 'TEXTAREA' &&
          (e.target as HTMLElement).tagName !== 'A'
        ) {
          setExpanded(!expanded);
        }
      }}
    >
      <div className="p-4 flex flex-col">
        <div className="text-md font-semibold text-gray-800 flex items-center gap-2">
          {session.label}
          {session.isStravaOnly && (
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1 w-max">
              From Strava
            </span>
          )}
        </div>
        {session.duration && (
          <div className="text-sm text-gray-500 mt-1">{session.duration} min</div>
        )}
        <div className="text-xs text-gray-400 mt-2">
          {expanded ? 'Tap to collapse' : 'Tap to expand'}
        </div>
      </div>

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
            {structured ? (
  <div className="mb-4 whitespace-pre-wrap text-sm text-gray-800">
    <div className="font-semibold mb-2">Session Details</div>
    {structured}
  </div>
) : (
  <div className="text-gray-500 text-center mb-4">No full workout loaded yet.</div>
)}

            {!session.isStravaOnly && (
              <>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChange('done');
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
                      handleChange('skipped');
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

                <div className="mb-4">
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                    placeholder="Write your notes..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={saveNote}
                  />
                  {savingNote && (
                    <div className="text-xs text-gray-400 mt-1">Saving...</div>
                  )}
                </div>

                <div className="flex justify-center">
                  <Link
                    href={`/coaching?prefill=${encodeURIComponent(
                      `Hey coach, can you give me a detailed workout for my "${session.label}" session on ${dayFormatted}?`
                    )}`}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-full text-sm hover:bg-blue-50 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    💬 Ask your coach for a detailed workout
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
