'use client';

import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { WeeklySummary } from '@/utils/getWeeklySummary';
import CompliancePanel from '../coaching/CompliancePanel';
import FitnessPanel from '../coaching/FitnessPanel';
import WeeklySummaryPanel from '../coaching/WeeklySummaryPanel';

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: Session[];
  stravaActivities?: StravaActivity[];
  weeklySummary: WeeklySummary;
  weeklyVolume: number[];
};

export default function CoachingDashboard({
  userId,
  sessions,
  completedSessions,
  stravaActivities = [],
  weeklySummary,
  weeklyVolume,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">🧑‍🏫 Coaching Dashboard</h1>

      <CompliancePanel summary={weeklySummary} />

      <FitnessPanel
        sessions={sessions}
        completedSessions={completedSessions}
        stravaActivities={stravaActivities}
      />

      <WeeklySummaryPanel
        sessions={sessions}
        completedSessions={completedSessions}
        stravaActivities={stravaActivities}
      />
    </div>
  );
}
