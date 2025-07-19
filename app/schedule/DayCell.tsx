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

const getSessionTitle = (title: string) => {
  return title.split(':')[0]?.trim() || 'Untitled';
};

const getSessionColor = (sport: string | null | undefined) => {
  const safe = sport?.toLowerCase?.() || '';

  switch (safe) {
    case 'swim':
      return 'bg-blue-100 text-blue-800';
    case 'bike':
      return 'bg-yellow-100 text-yellow-800';
    case 'run':
      return 'bg-green-100 text-green-800';
    case 'strength':
      return 'bg-purple-100 text-purple-800';
    case 'rest':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-primary/10 text-primary';
  }
};

export default function DayCell({ date, sessions, isOutside, onSessionClick }: Props) {
  return (
    <div
      className={clsx(
        'h-28 p-2 border text-xs relative transition-all duration-150 overflow-hidden',
        isOutside ? 'bg-muted text-muted-foreground' : 'bg-white',
        isToday(date) && 'border-blue-500'
      )}
    >
      <div className="absolute top-2 right-2 text-[10px] font-medium">{format(date, 'd')}</div>

      <div className="mt-4 space-y-1 max-h-[72px] overflow-y-auto pr-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSessionClick?.(s)}
            className={clsx(
              'block text-[11px] truncate rounded px-1 py-0.5 w-full text-left',
              getSessionColor(s.sport)
            )}
            title={s.title ?? 'Untitled'}
          >
            {getSessionTitle(s.title ?? '')}
          </button>
        ))}
      </div>
    </div>
  );
}
