'use client';

import { format, isSameMonth } from 'date-fns';
import SessionCard from './SessionCard';

interface CalendarTileProps {
  date: Date;
  sessions: string[];
  isCurrentMonth: boolean;
  onClick: (sessionTitle: string) => void;
}

export default function CalendarTile({
  date,
  sessions,
  isCurrentMonth,
  onClick,
}: CalendarTileProps) {
  const key = format(date, 'yyyy-MM-dd');

  return (
    <div
      key={key}
      className={`bg-white px-2 py-2 text-left min-h-[100px] relative transition-all ${
        isCurrentMonth ? 'text-black' : 'text-neutral-300'
      } cursor-pointer hover:bg-neutral-50 border border-neutral-200`}
      onClick={() => {
        const first = sessions[0];
        if (first) onClick(first);
      }}
    >
      {/* Date Label */}
      <div className="text-[10px] text-neutral-400 uppercase font-medium mb-1">
        {format(date, 'MMM d')}
      </div>

      {/* Sessions */}
      {sessions.slice(0, 3).map((title, i) => (
        <SessionCard key={i} title={title} />
      ))}

      {/* Overflow Count */}
      {sessions.length > 3 && (
        <div className="text-[10px] text-neutral-400 mt-1">
          +{sessions.length - 3} more
        </div>
      )}
    </div>
  );
}
