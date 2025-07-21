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

function normalizeSport(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('swim')) return 'swim';
  if (lower.includes('bike')) return 'bike';
  if (lower.includes('run')) return 'run';
  if (lower.includes('rest')) return 'rest';
  return 'other';
}

export default function DayCell({ date, sessions, isOutside, onSessionClick }: Props) {
  return (
    <div
      className={clsx(
        'h-28 p-2 border text-xs relative transition-all duration-150 overflow-hidden group',
        isToday(date) && 'ring-2 ring-zinc-300 bg-zinc-50',
        isOutside ? 'bg-white text-zinc-300' : 'bg-white text-zinc-800'
      )}
    >
      <div className="absolute top-2 right-2 text-[10px] font-medium">
        {format(date, 'd')}
      </div>

      <div className="mt-5 flex flex-col gap-1 max-h-[70px] overflow-y-auto pr-1">
        {sessions.map((s) => {
          const rawTitle = s.title ?? '';
          const isRest = rawTitle.toLowerCase().includes('rest day');
          const sport = s.sport || normalizeSport(rawTitle);
          const colorClass = getSessionColor(isRest ? 'rest' : sport);

          const displayTitle = isRest
            ? '🛌 Rest Day'
            : rawTitle.replace(/^.{0,2}/, '').split(':')[0]?.trim() || 'Untitled';

          return (
            <button
              key={s.id}
              onClick={() => !isRest && onSessionClick?.(s)}
              className={clsx(
                'block truncate rounded-md px-2 py-1 w-full text-left text-[11px] font-medium',
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
