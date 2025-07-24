'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Bike, Run

const categoryMap: Record<string, string> = {
  swim: 'Swim',
  bike: 'Bike',
  ride: 'Bike',
  virtualride: 'Bike',
  run: 'Run',
  strength: 'Strength',
};

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: Session[];
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: {
    totalPlanned: number;
    totalCompleted: number;
    sportBreakdown: {
      sport: string;
      planned: number;
      completed: number;
    }[];
    adherence: number;
  };
};

export default function CoachingDashboard({
  userId,
  sessions,
  completedSessions,
  stravaActivities,
  weeklyVolume,
  weeklySummary,
}: Props) {
  const [totalTime, setTotalTime] = useState(0);
  const [sportBreakdown, setSportBreakdown] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const breakdownMap: Record<string, number> = {};
    let timeSum = 0;

    sessions.forEach((s) => {
      const category = categoryMap[s.sport?.toLowerCase?.() || ''] || 'Other';
      const duration = s.duration ?? estimateDurationFromTitle(s.title);
      breakdownMap[category] = (breakdownMap[category] || 0) + duration;
      timeSum += duration;
    });

    const breakdown = Object.entries(breakdownMap).map(([name, value]) => ({ name, value }));
    setSportBreakdown(breakdown);
    setTotalTime(timeSum);
  }, [sessions]);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">🏊‍♀️ Weekly Training Summary</h2>
      <p className="mt-4 text-sm text-gray-700">
        Total time trained: <strong>{totalTime}</strong> minutes
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
              label
            >
              {sportBreakdown.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-gray-500 italic">
        Adherence: {weeklySummary.adherence}% — {weeklySummary.totalCompleted}/{weeklySummary.totalPlanned} sessions completed
      </p>
    </div>
  );
}
