'use client';
import { useState } from 'react';
import { FlipCard } from './FlipCard';

interface SessionCardProps {
  title: string;
  duration?: string; // optional for now
  details?: string[]; // optional for now
}

export function SessionCard({ title, duration = '', details = [] }: SessionCardProps) {
  const [note, setNote] = useState('');

  const front = (
    <div className="flex flex-col items-center justify-center text-center p-4">
      <div className="text-md font-semibold">{title}</div>
      {duration && <div className="text-sm text-gray-500 mt-1">{duration}</div>}
      <div className="text-xs text-gray-400 mt-2">(Tap to view details)</div>
    </div>
  );

  const back = (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 mb-2 overflow-y-auto">
        <div className="text-sm font-semibold mb-2">Session Details</div>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
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
      <div className="mt-auto">
        <textarea
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
          placeholder="Write your notes..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            console.log('Auto-saving note:', note); // TODO: later, hook to Supabase save
          }}
        />
      </div>
    </div>
  );

  return (
    <FlipCard front={front} back={back} />
  );
}
