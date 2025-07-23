'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, startOfWeek } from 'date-fns';
import { StravaActivity } from '@/types/strava';
import estimateDurationFromTitle from '@/utils/estimateDurationFromTitle';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Ride, Run
const categoryMap: Record<string, string> = {
  swim: 'Swim',
  ride: 'Ride',
  virtualride: 'Ride',
  run: 'Run',
};

type Summary = {
  totalTime: number;
  weeklyVolume: number[];
  sportBreakdown: { name: string; value: number }[];
  consistency: string;
};

export default function DashboardSummary({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<Summary>({
    totalTime: 0,
    weeklyVolume: [],
    sportBreakdown: [],
    consistency: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/weekly-summary?userId=${userId}`);
        const data = await res.json();

        const totalTime = data.sessions.reduce((sum: number, session: any) => {
          return sum + (session.duration ?? estimateDurationFromTitle(session.title));
        }, 0);

        const sportBreakdownMap: Record<string, number> = {};

        data.sessions.forEach((session: any) => {
          const category = categoryMap[session.sport?.toLowerCase?.()] || 'Other';
          const duration = session.duration ?? estimateDurationFromTitle(session.title);
          sportBreakdownMap[category] = (sportBreakdownMap[category] || 0) + duration;
        });

        const sportBreakdown = Object.entries(sportBreakdownMap).map(([name, value]) => ({
          name,
          value,
        }));

        setSummary({
          totalTime,
          weeklyVolume: data.weeklyVolume,
          sportBreakdown,
          consistency: data.consistency,
        });
      } catch (err) {
        console.error('Failed to load dashboard summary:', err);
      }
    };

    fetchData();
  }, [userId]);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">🏊‍♀️ Weekly Training Summary</h2>
      <p className="mt-4 text-sm text-gray-700">
        Total time trained: <strong>{summary.totalTime}</strong> minutes
      </p>

      <div className="mt-4 h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={summary.sportBreakdown}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              label
            >
              {summary.sportBreakdown.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-gray-500 italic">{summary.consistency}</p>
    </div>
  );
}
