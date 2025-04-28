'use client';
import { useState } from 'react';
import { FlipCard } from './FlipCard';

interface SessionCardProps {
  title: string;
  duration: string;
  details: string[];
}

export function SessionCard({ title, duration, details }: SessionCardProps) {
  const [note, setNote] = useState('');

  const front = (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-500">{duration}</div>
      <div className="text-xs mt-2 text-gray-400">(Tap to view details)</div>
    </div>
  );

  const back = (
    <div className="flex flex-col h-full">
      <div className="flex-1 mb-2">
        <div className="text-md font-bold mb-2">Session Details</div>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          {details.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ul>
      </div>
      <div className="mt-auto">
        <textarea
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
          placeholder="Write your notes..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            // TODO: save note to db/local storage if needed
            console.log('Auto-saving note:', note);
          }}
        />
      </div>
    </div>
  );

  return <FlipCard front={front} back={back} />;
}
