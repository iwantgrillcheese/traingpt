'use client';

import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import type { Session } from '@/types/session';
import { getSessionColor } from '@/utils/session-utils';

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
        'h-28 p-2 border text-xs relative transition-all duration-150 overflow-hidden group hover:bg-zinc-50',
        isOutside ? 'bg-muted text-muted-foreground' : 'bg-white',
        isToday(date) && 'ring-2 ring-zinc-300 bg-zinc-50'
      )}
    >
      <div className="absolute top-2 right-2 text-[10px] font-medium">{format(date, 'd')}</div>

      <div className="mt-4 space-y-1 max-h-[72px] overflow-y-auto pr-1">
        {sessions.map((s) => {
          const rawTitle = s.title ?? '';
          const isRest = rawTitle.toLowerCase().includes('rest day');
          const displayTitle = isRest ? '🛌 Rest Day' : rawTitle.split(':')[0]?.trim() || 'Untitled';
          const colorClass = getSessionColor(isRest ? 'rest' : s.sport || '');

          return (
            <button
              key={s.id}
              onClick={() => !isRest && onSessionClick?.(s)}
              className={clsx(
                'block text-[11px] truncate rounded-full px-3 py-1 w-full text-left font-medium',
                colorClass
              )}
              title={rawTitle}
            >
              {displayTitle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
