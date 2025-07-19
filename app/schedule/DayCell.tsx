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

export default function DayCell({ date, sessions, isOutside, onSessionClick }: Props) {
  return (
    <div
      className={clsx(
        'h-28 p-2 border text-xs relative transition-all duration-150',
        isOutside ? 'bg-muted text-muted-foreground' : 'bg-white',
        isToday(date) && 'border-blue-500'
      )}
    >
      <div className="absolute top-2 right-2 text-[10px] font-medium">{format(date, 'd')}</div>
      <div className="mt-4 space-y-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSessionClick?.(s)}
            className="block text-[11px] truncate rounded bg-primary/10 text-primary px-1 py-0.5 w-full text-left"
            title={s.label}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
