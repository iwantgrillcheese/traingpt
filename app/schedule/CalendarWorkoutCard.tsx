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
      className={`min-h-[55px] w-full rounded-xl border border-[#E8EAED] px-2.5 py-2 text-left shadow-[0_2px_7px_rgba(17,24,39,0.035)] transition hover:border-[#AEB5BF] hover:bg-[#ECEEF1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827] ${status === 'done' ? 'bg-[#F0F5F1]' : 'bg-[#F5F6F8]'} ${status === 'skipped' ? 'opacity-55' : ''} ${rest ? 'cursor-default' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="line-clamp-2 min-w-0 break-words text-[12px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#222630]">{title}</span>
        {status === 'done' ? <span aria-label="Completed" className="mt-0.5 shrink-0 font-bold leading-none text-[#228559]">✓</span> : null}
        {status === 'skipped' ? <span className="shrink-0 text-[9px] font-medium text-[#767E88]">Skipped</span> : null}
      </div>
      {!rest ? <p className="mt-1 text-[10px] font-medium leading-4 text-[#747C87]">{duration ? `${duration} · ` : ''}{sport}{strava ? ' · Strava' : ''}</p> : null}
    </button>
  );
}
