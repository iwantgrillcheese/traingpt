'use client';

import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import { calendarSport, formatTrainingMinutes, isRestSession, sessionStatus, sportColor, workoutTitle } from './calendar-utils';

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
      style={{ borderLeftColor: sportColor(sport) }}
      className={`w-full rounded-xl border border-[#E3E0D8] border-l-[3px] px-3 py-2.5 text-left transition hover:bg-[#F7F6F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101114] ${status === 'done' || rest ? 'bg-[#F7F6F2]' : 'bg-white'} ${status === 'skipped' ? 'opacity-50' : ''} ${rest ? 'cursor-default' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 break-words text-[13px] font-semibold leading-snug text-[#101114]">{title}</span>
        {status === 'done' ? <span aria-hidden="true" className="shrink-0 text-xs font-bold text-[#4B5563]">✓</span> : null}
        {status === 'skipped' ? <span className="shrink-0 text-[10px] text-[#6B7280]">Skipped</span> : null}
      </div>
      {!rest ? <p className="mt-1 text-[11px] leading-4 text-[#6B7280]">{duration ? `${duration} · ` : ''}{sport}{activity ? ' · Strava' : ''}</p> : null}
    </button>
  );
}
