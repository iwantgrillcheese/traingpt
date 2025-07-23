'use client';

import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import type { Session } from '@/types/session';
import { getSessionColor } from '@/utils/session-utils';

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  date: Date;
  sessions: Session[];
  isOutside: boolean;
  onSessionClick?: (session: Session) => void;
  completedSessions: CompletedSession[];
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

export default function DayCell({
  date,
  sessions,
  isOutside,
  onSessionClick,
  completedSessions,
}: Props) {
  const dateKey = format(date, 'yyyy-MM-dd');

  const isSessionCompleted = (session: Session) =>
    completedSessions.some(
      (c) =>
        c.session_date === session.date &&
        c.session_title === session.title
    );

  return (
    <div
      className={clsx(
        'min-h-[220px] p-4 border rounded-xl flex flex-col gap-2 transition-all duration-150 w-full',
        isOutside ? 'bg-zinc-100 text-zinc-400' : 'bg-white text-black',
        isToday(date) && 'ring-2 ring-blue-400'
      )}
    >
      <div className="text-sm font-semibold text-right">{format(date, 'd')}</div>

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const rawTitle = s.title ?? '';
            const isRest = rawTitle.toLowerCase().includes('rest day');
            const sport = s.sport || normalizeSport(rawTitle);
            const colorClass = getSessionColor(isRest ? 'rest' : sport);
            const isCompleted = isSessionCompleted(s);

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
                  'w-full text-left rounded-md px-3 py-2 shadow-sm hover:bg-opacity-80 transition-all',
                  colorClass,
                  isCompleted ? 'bg-green-100 border border-green-400' : 'bg-muted/20'
                )}
                title={rawTitle}
              >
                <div className="font-medium text-sm truncate">
                  {titleLine} {isCompleted && <span className="text-green-600">✓</span>}
                </div>
                {detailLine && (
                  <div className="text-xs text-muted-foreground truncate">
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
