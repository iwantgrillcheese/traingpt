'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { StravaActivity } from '@/types/strava';
import { format, startOfWeek, parseISO } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Bike, Run

const categoryMap: Record<string, string> = {
  swim: 'Swim',
  ride: 'Bike',
  virtualride: 'Bike',
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
    if (!userId) {
      console.warn('Missing user ID');
      return;
    }

    const fetchData = async () => {
      const supabase = createClientComponentClient();

      const start = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

      const { data: activities, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', start);

      if (error) {
        console.error('Strava fetch error:', error.message);
        return;
      }

      if (!activities || activities.length === 0) {
        setSummary({
          totalTime: 0,
          weeklyVolume: [],
          sportBreakdown: [],
          consistency: 'No training data available this week.',
        });
        return;
      }

      const weeklyVolume = Array(7).fill(0);
      const sportMap: Record<string, number> = {};
      let completedSessions = 0;

      for (const activity of activities as StravaActivity[]) {
        const date = parseISO(activity.start_date);
        const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const durationHours = (activity.moving_time || 0) / 3600;

        weeklyVolume[dayIdx] += durationHours;
        completedSessions++;

        const cat = categoryMap[activity.sport_type.toLowerCase()] || 'Other';
        sportMap[cat] = (sportMap[cat] || 0) + 1;
      }

      const sportBreakdown = Object.entries(sportMap).map(([name, value]) => ({ name, value }));

      setSummary({
        totalTime: weeklyVolume.reduce((a, b) => a + b, 0),
        weeklyVolume,
        sportBreakdown,
        consistency: `${completedSessions} session${completedSessions !== 1 ? 's' : ''} this week`,
      });
    };

    fetchData();
  }, [userId]);

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <h2 className="text-lg font-semibold mb-2">Weekly Summary</h2>
      <p className="text-sm text-gray-600 mb-2">
        Total Time: {summary.totalTime.toFixed(1)} hrs
      </p>
      <p className="text-sm text-gray-600 mb-4">{summary.consistency}</p>

      {summary.sportBreakdown.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={summary.sportBreakdown}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={70}
              dataKey="value"
            >
              {summary.sportBreakdown.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-500 text-center">No activity breakdown yet.</p>
      )}
    </div>
  );
}
