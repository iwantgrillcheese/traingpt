'use client';

import {
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
} from 'date-fns';
import DayCell from './DayCell';
import mergeSessionWithStrava, { MergedSession } from '@/utils/mergeSessionWithStrava';
import { StravaActivity } from '@/types/strava';
import { Session } from '@/types/session';

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

type Props = {
  sessions: Session[];
  completedSessions: CompletedSession[];
  stravaActivities: StravaActivity[];
  onSessionClick?: (session: Session) => void;
  currentMonth: Date;
};

export default function MonthGrid({
  sessions,
  completedSessions,
  stravaActivities,
  onSessionClick,
  currentMonth,
}: Props) {
  const mergedSessions: MergedSession[] = mergeSessionWithStrava(sessions, stravaActivities);

  const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

  const days = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-7 text-sm text-muted-foreground font-medium w-full">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-6 w-full">
        {days.map((day) => {
          const daySessions = mergedSessions.filter((s) =>
            isSameDay(parseISO(s.date), day)
          );

          return (
            <DayCell
              key={day.toISOString()}
              date={day}
              sessions={daySessions}
              isOutside={day.getMonth() !== currentMonth.getMonth()}
              onSessionClick={onSessionClick}
              completedSessions={completedSessions}
            />
          );
        })}
      </div>
    </div>
  );
}
