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
        'w-full min-h-[240px] p-4 border rounded-xl flex flex-col gap-2 transition-all duration-150',
        isOutside ? 'bg-zinc-100 text-zinc-400' : 'bg-white text-black',
        isToday(date) && 'ring-2 ring-blue-400'
      )}
    >
      <div className="text-sm font-semibold text-right">{format(date, 'd')}</div>

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-1">
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
                  'w-full text-left rounded-md px-2 py-1 text-sm leading-tight shadow-sm hover:brightness-95',
                  colorClass
                )}
                title={rawTitle}
              >
                <div className="font-medium truncate">{titleLine}</div>
                {detailLine && (
                  <div className="text-xs opacity-80 truncate">
                    {detailLine}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
