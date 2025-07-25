'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { WeeklySummary } from '@/utils/getWeeklySummary'; // ✅ imported correctly

import CompliancePanel from '@/app/coaching/CompliancePanel';
import WeeklySummaryPanel from '@/app/coaching/WeeklySummaryPanel';
import FitnessPanel from '@/app/coaching/FitnessPanel';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Bike, Run

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: Session[];
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: WeeklySummary; // ✅ uses full typed shape
  stravaConnected: boolean;
};

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return '0 min';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;
};

export default function CoachingDashboard({
  userId,
  sessions,
  completedSessions,
  stravaActivities,
  weeklyVolume,
  weeklySummary,
  stravaConnected,
}: Props) {
  const [totalTime, setTotalTime] = useState(0);
  const [sportBreakdown, setSportBreakdown] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const breakdown = weeklySummary.sportBreakdown.map(({ sport, completed }) => ({
      name: sport || 'Other',
      value: completed ?? 0,
    }));

    const time = breakdown.reduce((sum, b) => sum + b.value, 0);
    setSportBreakdown(breakdown);
    setTotalTime(Math.round(time * 10) / 10); // round to 1 decimal
  }, [weeklySummary]);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <StravaConnectBanner stravaConnected={stravaConnected} />

      <h2 className="text-lg font-semibold text-gray-900">🏊‍♀️ Weekly Training Summary</h2>
      <p className="mt-4 text-sm text-gray-700">
        Total time trained: <strong>{formatMinutes(totalTime)}</strong>
      </p>

      <div className="mt-4 h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={sportBreakdown}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              label={({ name, value }) => `${name}: ${formatMinutes(Number(value))}`}
              labelLine={false}
            >
              {sportBreakdown.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMinutes(Number(value))}
              labelFormatter={() => `Sport`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-gray-500 italic">
        Adherence: {weeklySummary.adherence}% —{' '}
        {weeklySummary.debug?.completedSessionsCount ?? 0}/
        {weeklySummary.debug?.plannedSessionsCount ?? 0} sessions completed
      </p>

      <WeeklySummaryPanel weeklySummary={weeklySummary} />
      <CompliancePanel weeklySummary={weeklySummary} />

      <FitnessPanel
        sessions={sessions}
        completedSessions={completedSessions}
        stravaActivities={stravaActivities}
      />
    </div>
  );
}
