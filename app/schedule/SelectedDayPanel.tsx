'use client';

import { addDays, format, startOfWeek } from 'date-fns';
import type { CompletedSession } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';
import { calendarSport, formatTrainingMinutes, isRestSession, sessionStatus, workoutTitle } from './calendar-utils';

type Props = {
  date: Date;
  sessions: MergedSession[];
  completedSessions: CompletedSession[];
  activities: StravaActivity[];
  weekSessions: MergedSession[];
  weekPhaseSummary?: string;
  onOpenSession: (session: MergedSession) => void;
  onOpenActivity: (activity: StravaActivity) => void;
  onAddSession: (date: Date) => void;
};

function minutes(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Content comes from the athlete's own plan, never a fabricated zone, pace or HR target. */
function concise(text?: string | null, limit = 86) {
  const normalized = String(text ?? '').replace(/^(Purpose|Workout|Intensity):\s*/i, '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit - 1).trimEnd() + '…';
}

function statusLabel(status: string | null) {
  if (status === 'done') return 'Completed';
  if (status === 'skipped') return 'Skipped';
  return 'Planned';
}

export default function SelectedDayPanel({
  date, sessions, completedSessions, activities, weekSessions, weekPhaseSummary,
  onOpenSession, onOpenActivity, onAddSession,
}: Props) {
  const workouts = sessions.filter(session => !isRestSession(session));
  const totalMinutes = workouts.reduce((sum, session) => sum + minutes(session.duration), 0);
  const count = workouts.length + activities.length;
  const dayNote = workouts.map(session => concise(session.coach_note, 155)).find(Boolean);

  const start = startOfWeek(date, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    const key = format(day, 'yyyy-MM-dd');
    const scheduled = weekSessions.filter(session => session.date === key && !isRestSession(session));
    const planned = scheduled.reduce((sum, session) => sum + minutes(session.duration), 0);
    const completed = scheduled.filter(session => sessionStatus(session, completedSessions) === 'done')
      .reduce((sum, session) => sum + minutes(session.duration), 0);
    return { day, key, planned, completed, selected: key === format(date, 'yyyy-MM-dd') };
  });
  const maxMinutes = Math.max(1, ...week.map(day => day.planned));

  return (
    <aside aria-label={`Training details for ${format(date, 'MMMM d')}`} className="overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-[#FBFCFD] shadow-[0_10px_28px_rgba(16,24,40,0.045)]">
      <div className="border-b border-[#E6EAF0] bg-gradient-to-br from-[#EDF1F6] via-[#F5F7FA] to-[#FAFBFC] px-6 pb-7 pt-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#566071]">{format(date, 'EEE, MMM d')}</p>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_126px] items-end gap-3">
          <div className="min-w-0">
            <h2 className="text-[31px] font-bold leading-none tracking-[-0.045em] text-[#141820]">
              {count} {count === 1 ? 'Workout' : 'Workouts'}
            </h2>
            <p className="mt-4 text-[12px] font-medium leading-5 text-[#525B68]">
              {formatTrainingMinutes(totalMinutes) ?? 'No planned time'}
              {totalMinutes ? ' planned' : ''}
              {weekPhaseSummary ? <><span aria-hidden="true" className="px-1">·</span>{weekPhaseSummary}</> : null}
            </p>
          </div>
          <div className="min-w-0" title="This week’s scheduled duration; green indicates completed workouts">
            <p className="mb-2 text-right text-[9px] font-bold uppercase tracking-[0.13em] text-[#858E9B]">This week</p>
            <div role="img" aria-label="Seven-day planned training duration chart; green indicates completed workouts" className="grid grid-cols-7 items-end gap-[5px]">
              {week.map(day => {
                const height = day.planned ? Math.max(5, Math.round(day.planned / maxMinutes * 48)) : 3;
                const doneHeight = day.planned ? Math.min(100, day.completed / day.planned * 100) : 0;
                return (
                  <div key={day.key} className="flex flex-col items-center gap-1">
                    <div className="flex h-[51px] w-full items-end justify-center">
                      <div className={`relative w-3 overflow-hidden rounded-[3px] ${day.selected ? 'bg-[#4E5969]' : 'bg-[#B7C0CA]'}`} style={{ height: `${height}px` }}>
                        {doneHeight > 0 ? <span className="absolute inset-x-0 bottom-0 bg-[#238459]" style={{ height: `${doneHeight}%` }} /> : null}
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold ${day.selected ? 'text-[#232934]' : 'text-[#9DA5B1]'}`}>{format(day.day, 'EEEEE')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {workouts.map(session => {
          const status = sessionStatus(session, completedSessions);
          const done = status === 'done';
          const sport = calendarSport(session.sport);
          const actualMinutes = session.stravaActivity ? minutes(session.stravaActivity.moving_time) / 60 : minutes(session.duration);
          const focus = concise(session.purpose, 96) || concise(session.details && session.details.length < 100 ? session.details : null, 96);
          return (
            <button key={session.id} type="button" onClick={() => onOpenSession(session)}
              className="group block w-full rounded-[18px] border border-[#E5E8ED] bg-white p-[18px] text-left shadow-[0_3px_10px_rgba(16,24,40,0.025)] transition hover:border-[#B9C2CE] hover:shadow-[0_9px_20px_rgba(16,24,40,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171B23]">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border ${done ? 'border-[#26845E] bg-[#26845E] text-white' : 'border-[#C6CDD7] bg-white'}`}>
                  {done ? <span className="text-xs leading-none">✓</span> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#151921]">{workoutTitle(session.title)}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${done ? 'bg-[#E7F4EC] text-[#187349]' : 'bg-[#F0F2F5] text-[#646B76]'}`}>{statusLabel(status)}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#6C7480]">{formatTrainingMinutes(actualMinutes) ?? 'Flexible'} · {sport}{session.stravaActivity ? ' · Strava' : ''}</p>
                </div>
              </div>
              {(session.intensity || focus) ? (
                <div className="mt-4 grid gap-x-3 gap-y-3 border-t border-[#EDF0F3] pt-3 sm:grid-cols-2">
                  {session.intensity ? <div className="min-w-0"><div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#959EAA]">Intensity</div><div className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-[#3E4653]">{concise(session.intensity, 65)}</div></div> : null}
                  {focus ? <div className="min-w-0"><div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#959EAA]">Focus</div><div className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-[#3E4653]">{focus}</div></div> : null}
                </div>
              ) : null}
              <span className="mt-3 block text-right text-[11px] font-semibold text-[#747E8A] group-hover:text-[#151921]">View workout →</span>
            </button>
          );
        })}
        {activities.map(activity => (
          <button key={String(activity.strava_id ?? activity.id)} type="button" onClick={() => onOpenActivity(activity)}
            className="w-full rounded-[18px] border border-[#E5E8ED] bg-white p-[18px] text-left transition hover:border-[#B9C2CE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171B23]">
            <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 font-semibold text-[#151921]">{workoutTitle(activity.name)}</h3><span className="rounded-full bg-[#E7F4EC] px-2.5 py-1 text-[10px] font-semibold text-[#187349]">Strava</span></div>
            <p className="mt-2 text-xs text-[#6C7480]">{formatTrainingMinutes(minutes(activity.moving_time) / 60) ?? 'Activity'} · {calendarSport(activity.sport_type)}</p>
          </button>
        ))}
        {count === 0 ? <div className="rounded-[18px] border border-dashed border-[#DCE2E9] bg-white px-5 py-8 text-center"><p className="text-sm font-semibold text-[#29303B]">No workouts scheduled</p><button type="button" onClick={() => onAddSession(date)} className="mt-3 text-xs font-semibold text-[#596575] underline underline-offset-4">Add a workout</button></div> : null}
        {dayNote ? <div className="rounded-[17px] bg-[#F0F3F7] px-4 py-3.5"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#687381]">Coach note</div><p className="mt-1.5 text-[12px] leading-[1.65] text-[#4B5563]">{dayNote}</p></div> : null}
      </div>
    </aside>
  );
}
