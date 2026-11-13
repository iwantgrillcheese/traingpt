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

const statusStyles = {
  done: 'bg-[#E6F4EC] text-[#147D50]',
  skipped: 'bg-[#F2F2F2] text-[#737783]',
  planned: 'bg-[#F2F3F5] text-[#555D68]',
} as const;

function validMinutes(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function sessionNote(session: MergedSession) {
  const text = String(session.purpose || session.coach_note || session.details || '')
    .replace(/^(Purpose|Workout|Intensity):\s*/i, '').replace(/\s+/g, ' ').trim();
  return text.length > 190 ? text.slice(0, 187).trimEnd() + '…' : text;
}

export default function SelectedDayPanel({
  date,
  sessions,
  completedSessions,
  activities,
  weekSessions,
  weekPhaseSummary,
  onOpenSession,
  onOpenActivity,
  onAddSession,
}: Props) {
  const visibleSessions = sessions.filter(session => !isRestSession(session));
  const totalMinutes = visibleSessions.reduce((total, session) => total + validMinutes(session.duration), 0);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const key = format(day, 'yyyy-MM-dd');
    const scheduled = weekSessions.filter(session => session.date === key && !isRestSession(session));
    const planned = scheduled.reduce((total, session) => total + validMinutes(session.duration), 0);
    const completed = scheduled
      .filter(session => sessionStatus(session, completedSessions) === 'done')
      .reduce((total, session) => total + validMinutes(session.duration), 0);
    return { key, day, planned, completed, selected: key === format(date, 'yyyy-MM-dd') };
  });
  const maxMinutes = Math.max(1, ...days.map(day => day.planned));
  const note = visibleSessions.map(sessionNote).find(Boolean);
  const count = visibleSessions.length + activities.length;
  const weekLabel = format(weekStart, 'MMM d') + '–' + format(addDays(weekStart, 6), 'MMM d');

  return (
    <aside aria-label={`Training details for ${format(date, 'MMMM d')}`} className="overflow-hidden rounded-[22px] border border-[#E2E4E8] bg-white shadow-[0_16px_40px_rgba(17,24,39,0.045)]">
      <div className="border-b border-[#E8EAEE] bg-[#F7F8FA] px-5 pb-5 pt-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#626B7A]">{format(date, 'EEE, MMM d')}</div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h2 className="text-[30px] font-bold leading-none tracking-[-0.05em] text-[#141820]">
            {count} {count === 1 ? 'Workout' : 'Workouts'}
          </h2>
          <button type="button" onClick={() => onAddSession(date)}
            className="rounded-full border border-[#D8DCE2] bg-white px-3 py-1.5 text-xs font-semibold text-[#343A45] hover:border-[#9CA3AF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]">
            + Add
          </button>
        </div>
        <p className="mt-3 text-sm font-medium text-[#5E6672]">
          {formatTrainingMinutes(totalMinutes) ?? 'No planned time'} {totalMinutes ? 'planned' : ''}
          {weekPhaseSummary ? <span> · {weekPhaseSummary}</span> : null}
        </p>

        <div className="mt-6 rounded-2xl border border-[#E5E7EA] bg-white px-4 pb-3 pt-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#3C424D]">Training rhythm</span>
            <span className="text-[11px] text-[#858C97]">{weekLabel}</span>
          </div>
          <div className="grid grid-cols-7 gap-2" aria-label="Planned training minutes across the selected week; green shows completed sessions">
            {days.map(day => {
              const height = day.planned ? Math.max(8, Math.round(day.planned / maxMinutes * 67)) : 3;
              const doneHeight = day.planned ? Math.min(100, day.completed / day.planned * 100) : 0;
              return (
                <div key={day.key} className={`flex flex-col items-center rounded-lg px-0.5 pb-1 ${day.selected ? 'bg-[#F0F2F5]' : ''}`}
                  title={`${format(day.day, 'EEE, MMM d')}: ${formatTrainingMinutes(day.planned) ?? '0m'} planned`}>
                  <div className="flex h-[70px] w-full items-end justify-center">
                    <div className="relative w-[19px] overflow-hidden rounded-[5px] bg-[#B6BDC8]" style={{ height: `${height}px` }}>
                      {doneHeight > 0 ? <div className="absolute inset-x-0 bottom-0 bg-[#2D986B]" style={{ height: `${doneHeight}%` }} /> : null}
                    </div>
                  </div>
                  <span className={`mt-2 text-[10px] font-bold ${day.selected ? 'text-[#141820]' : 'text-[#989EAA]'}`}>{format(day.day, 'EEEEE')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {visibleSessions.map(session => {
          const status = sessionStatus(session, completedSessions);
          const statusKey = status === 'done' ? 'done' : status === 'skipped' ? 'skipped' : 'planned';
          const duration = formatTrainingMinutes(session.stravaActivity ? validMinutes(session.stravaActivity.moving_time) / 60 : session.duration);
          const purpose = sessionNote(session);
          return (
            <button type="button" key={session.id} onClick={() => onOpenSession(session)}
              className="group w-full rounded-[18px] border border-[#E5E7EB] bg-white p-4 text-left shadow-[0_6px_18px_rgba(12,17,27,0.035)] transition hover:border-[#AEB6C2] hover:shadow-[0_8px_22px_rgba(12,17,27,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border ${statusKey === 'done' ? 'border-[#218A60] bg-[#218A60] text-white' : 'border-[#C8CDD5]'}`}>
                  {statusKey === 'done' ? <span className="text-xs">✓</span> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-bold tracking-[-0.035em] text-[#171B23]">{workoutTitle(session.title)}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[statusKey]}`}>
                      {statusKey === 'done' ? 'Completed' : statusKey === 'skipped' ? 'Skipped' : 'Planned'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#757D89]">{duration ?? 'Flexible'} · {calendarSport(session.sport)}{session.stravaActivity ? ' · Strava' : ''}</p>
                </div>
              </div>
              {(session.intensity || purpose) ? <div className="mt-4 border-t border-[#EBEDF0] pt-3">
                {session.intensity ? <div className="mb-2"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9198A4]">Intensity</span><p className="mt-0.5 text-xs font-medium text-[#353B45]">{session.intensity}</p></div> : null}
                {purpose ? <p className="line-clamp-2 text-xs leading-[1.6] text-[#626B78]">{purpose}</p> : null}
              </div> : null}
              <span className="mt-3 block text-right text-[11px] font-semibold text-[#737C89] group-hover:text-[#141820]">View workout →</span>
            </button>
          );
        })}
        {activities.map(activity => (
          <button type="button" key={String(activity.strava_id ?? activity.id)} onClick={() => onOpenActivity(activity)}
            className="w-full rounded-[18px] border border-[#E5E7EB] bg-white p-4 text-left transition hover:border-[#AEB6C2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#171B23]">{workoutTitle(activity.name)}</span>
              <span className="rounded-full bg-[#E6F4EC] px-2 py-1 text-[10px] font-semibold text-[#147D50]">Strava</span>
            </div>
            <p className="mt-1 text-xs text-[#757D89]">{formatTrainingMinutes(validMinutes(activity.moving_time) / 60) ?? 'Activity'} · {calendarSport(activity.sport_type)}</p>
          </button>
        ))}
        {count === 0 ? <div className="rounded-[18px] border border-dashed border-[#DCE0E6] px-5 py-8 text-center">
          <p className="text-sm font-semibold text-[#29303B]">No workouts scheduled</p>
          <p className="mt-1 text-xs text-[#7B8391]">Select another day or add a session.</p>
        </div> : null}
        {note ? <div className="rounded-[16px] bg-[#F6F7F9] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#707987]">Training intent</div>
          <p className="mt-1.5 text-xs leading-[1.65] text-[#4D5663]">{note}</p>
        </div> : null}
      </div>
    </aside>
  );
}
