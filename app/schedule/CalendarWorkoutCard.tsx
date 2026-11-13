'use client';

import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import { calendarSport, formatTrainingMinutes, isRestSession, sessionStatus, workoutTitle } from './calendar-utils';

type Props = {
  session?: MergedSession;
  activity?: StravaActivity;
  completedSessions: CompletedSession[];
  onClick: () => void;
};

export default function CalendarWorkoutCard({ session, activity, completedSessions, onClick }: Props) {
  const strava = activity ?? session?.stravaActivity;
  const sport = calendarSport(session?.sport ?? strava?.sport_type);
  const title = workoutTitle(session?.title ?? strava?.name);
  const rest = session ? isRestSession(session) : false;
  const status = session ? sessionStatus(session, completedSessions) : 'done';
  const duration = formatTrainingMinutes(strava ? (strava.moving_time ?? 0) / 60 : session?.duration);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={rest}
      aria-label={`${title}, ${duration ? `${duration}, ` : ''}${sport}${status ? `, ${status === 'done' ? 'completed' : 'skipped'}` : ''}`}
      title={title}
      className={`min-h-[56px] w-full rounded-[12px] border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414] ${status === 'done' ? 'border-[#242424] bg-[#242424] shadow-[0_4px_10px_rgba(0,0,0,0.1)] hover:bg-[#333333]' : 'border-[#DFDFDF] bg-[#F2F2F2] shadow-[0_2px_6px_rgba(0,0,0,0.035)] hover:border-[#BDBDBD] hover:bg-[#EAEAEA]'} ${status === 'skipped' ? 'opacity-55' : ''} ${rest ? 'cursor-default' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`line-clamp-2 min-w-0 break-words text-[12px] font-semibold leading-[1.3] tracking-[-0.025em] ${status === 'done' ? 'text-white' : 'text-[#151515]'}`}>{title}</span>
        {status === 'done' ? <span aria-label="Completed" className="mt-0.5 shrink-0 font-bold leading-none text-[#67D9A1]">✓</span> : null}
        {status === 'skipped' ? <span className="shrink-0 text-[9px] font-medium text-[#767E88]">Skipped</span> : null}
      </div>
      {!rest ? <p className={`mt-1 text-[10px] font-medium leading-4 ${status === 'done' ? 'text-[#CACACA]' : 'text-[#646464]'}`}>{duration ? `${duration} · ` : ''}{sport}{strava ? ' · Strava' : ''}</p> : null}
    </button>
  );
}
