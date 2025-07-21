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
  if (lower.includes('strength')) return 'strength';
  return 'other';
}

export default function DayCell({ date, sessions, isOutside, onSessionClick }: Props) {
  return (
    <div
      className={clsx(
        'h-28 p-2 border text-xs relative transition-all duration-150 overflow-hidden group',
        isOutside ? 'bg-zinc-100 text-zinc-400' : 'bg-white',
        isToday(date) && 'ring-2 ring-zinc-300 bg-zinc-50'
      )}
    >
      <div className="absolute top-2 right-2 text-[10px] font-medium">
        {format(date, 'd')}
      </div>

      <div className="mt-5 flex flex-col gap-1 max-h-[70px] overflow-y-auto pr-1 scrollbar-hide">
        {sessions.map((s) => {
          const rawTitle = s.title ?? '';
          const isRest = rawTitle.toLowerCase().includes('rest day');
          const sport = s.sport || normalizeSport(rawTitle);
          const colorClass = getSessionColor(isRest ? 'rest' : sport);

          const [labelLine, ...rest] = rawTitle.split(':');
          const titleLine = isRest
            ? '🛌 Rest Day'
            : labelLine?.trim() || 'Untitled';
          const detailLine = rest.join(':').trim();

          return (
            <button
              key={s.id}
              onClick={() => !isRest && onSessionClick?.(s)}
              className={clsx(
                'block w-full text-left rounded-md px-2 py-1 leading-tight shadow-sm hover:brightness-95 transition-all duration-100',
                colorClass
              )}
              title={rawTitle}
            >
              <div className="font-medium text-[11px] truncate">{titleLine}</div>
              {detailLine && (
                <div className="text-[10px] text-opacity-80 truncate">
                  {detailLine}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
