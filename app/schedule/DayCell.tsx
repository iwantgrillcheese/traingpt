'use client';

import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import type { Session } from '@/types/session';

type Props = {
  date: Date;
  sessions: Session[];
  isOutside: boolean;
  onSessionClick?: (session: Session) => void;
};

const getSessionColor = (sport: string | null | undefined) => {
  const safe = sport?.toLowerCase?.() || '';
  switch (safe) {
    case 'swim':
      return 'bg-blue-100 text-blue-700';
    case 'bike':
      return 'bg-yellow-100 text-yellow-700';
    case 'run':
      return 'bg-green-100 text-green-700';
    case 'strength':
      return 'bg-purple-100 text-purple-700';
    case 'rest':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-200 text-gray-700';
  }
};


export default function DayCell({ date, sessions, isOutside, onSessionClick }: Props) {
  return (
    <div
  className={clsx(
    'h-28 p-2 border text-xs relative transition-all duration-150 overflow-hidden rounded-sm',
    isOutside ? 'bg-muted text-muted-foreground' : 'bg-white',
    isToday(date) && 'border-blue-500'
  )}
    >
      <div className="absolute top-2 right-2 text-[10px] font-medium">{format(date, 'd')}</div>

      <div className="mt-6 space-y-1 max-h-[72px] overflow-y-auto pr-1">
        {sessions.map((s) => (
  <button
    key={s.id}
    onClick={() => onSessionClick?.(s)}
    className={clsx(
      'block text-[11px] truncate rounded px-1 py-0.5 w-full text-left',
      getSessionColor(s.sport)
    )}
    title={s.title}
  >
    {s.title || s.text || 'Untitled'}
  </button>
))}
      </div>
    </div>
  );
}
