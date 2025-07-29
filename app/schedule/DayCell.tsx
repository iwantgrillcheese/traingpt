'use client';

import { format, isToday } from 'date-fns';
import clsx from 'clsx';
import { getSessionColor } from '@/utils/session-utils';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import type { StravaActivity } from '@/types/strava';

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  date: Date;
  sessions: MergedSession[];
  isOutside: boolean;
  onSessionClick?: (session: MergedSession) => void;
  completedSessions: CompletedSession[];
  extraActivities?: StravaActivity[];
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

function sportEmoji(sport: string): string {
  switch (sport.toLowerCase()) {
    case 'swim':
      return '🏊';
    case 'bike':
      return '🚴';
    case 'run':
      return '🏃';
    case 'strength':
      return '💪';
    default:
      return '🔸';
  }
}

export default function DayCell({
  date,
  sessions,
  isOutside,
  onSessionClick,
  completedSessions,
  extraActivities = [],
}: Props) {
  const isSessionCompleted = (session: MergedSession) =>
    completedSessions.some(
      (c) => c.session_date === session.date && c.session_title === session.title
    );

  return (
    <div
      className={clsx(
        'min-h-[220px] p-3 border rounded-xl flex flex-col gap-2 transition-all duration-150 w-full',
        isOutside ? 'bg-zinc-100 text-zinc-400' : 'bg-white text-black',
        isToday(date) && 'ring-2 ring-blue-400'
      )}
    >
      <div className="text-sm font-semibold text-right">{format(date, 'd')}</div>

      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          const rawTitle = s.title ?? '';
          const isRest = rawTitle.toLowerCase().includes('rest day');
          const sport = s.sport || normalizeSport(rawTitle);
          const emoji = sportEmoji(sport);

          const colorClass = getSessionColor(isRest ? 'rest' : sport);

          const isStravaMatch = !!s.stravaActivity;
          const isCompleted = isSessionCompleted(s) || isStravaMatch;

          const [labelLine, ...rest] = rawTitle.split(':');
          const titleLine = isRest ? 'Rest Day' : labelLine?.trim() || 'Untitled';
          const detailLine = rest.join(':').trim();

          const activity = s.stravaActivity;
          const duration = activity?.moving_time
            ? `${Math.floor(activity.moving_time / 3600)}h ${Math.round((activity.moving_time % 3600) / 60)}m`
            : null;
          const distance = activity?.distance
            ? `${(activity.distance / 1609).toFixed(1)} mi`
            : null;
          const hr = activity?.average_heartrate
            ? `${Math.round(activity.average_heartrate)} bpm`
            : null;
          const watts = activity?.average_watts
            ? `${Math.round(activity.average_watts)}w`
            : null;

          return (
            <button
              key={s.id}
              onClick={() => !isRest && onSessionClick?.(s)}
              className={clsx(
                'w-full text-left rounded-md px-3 py-2 shadow-sm hover:bg-opacity-80 transition-all border',
                isStravaMatch
                  ? 'bg-blue-50 border-blue-300'
                  : isCompleted
                  ? 'bg-green-50 border-green-300'
                  : 'bg-muted/20 border-muted'
              )}
              title={rawTitle}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm truncate">
                  {emoji} {titleLine}
                </div>
                {isStravaMatch && <span className="text-xs text-blue-500">(Strava)</span>}
                {!isStravaMatch && isCompleted && <span className="text-sm text-green-600">✓</span>}
              </div>

              {detailLine && (
                <div className="text-xs text-muted-foreground truncate">{detailLine}</div>
              )}

              {isStravaMatch && (
                <div className="mt-1 text-xs text-blue-700 flex flex-col gap-0.5">
                  <div className="flex justify-between w-full">
                    <span>{duration}</span>
                    <span>{distance}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>{hr}</span>
                    <span>{watts}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}

        {extraActivities.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {extraActivities.map((a) => {
              const duration = a.moving_time ? `${Math.floor(a.moving_time / 60)}m` : '';
              const distance = a.distance ? `${(a.distance / 1609).toFixed(1)} mi` : '';
              const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';
              const watts = a.average_watts ? `${Math.round(a.average_watts)}w` : '';

              return (
                <div
                  key={a.id}
                  className="rounded-md bg-blue-50 border border-blue-300 px-3 py-2 text-xs text-blue-800"
                >
                  🚴 {a.name || 'Unplanned Activity'}
                  <div className="flex justify-between text-[11px]">
                    <span>{duration}</span>
                    <span>{distance}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>{hr}</span>
                    <span>{watts}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
