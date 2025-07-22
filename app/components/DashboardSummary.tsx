'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { StravaActivity } from '@/types/strava';
import { format, startOfWeek, addDays } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Bike, Run

const categoryMap: Record<string, string> = {
  Swim: 'Swim',
  Bike: 'Bike',
  Run: 'Run',
  Other: 'Other',
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
      const supabase = createClientComponentClient();
      const { data: activities } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', userId);

      if (!activities) return;

      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 1 });

      const weeklyVolume = Array(7).fill(0);
      const sportMap: Record<string, number> = {};

      let completedSessions = 0;

      for (const activity of activities as StravaActivity[]) {
        const date = new Date(activity.date);
        const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const duration = parseFloat(activity.avg_pace || '0') ? 1 : 0.5; // quick heuristic fallback

        if (date >= start) {
          weeklyVolume[dayIdx] += duration;
          completedSessions++;
        }

        const cat = categoryMap[activity.sport] || 'Other';
        sportMap[cat] = (sportMap[cat] || 0) + 1;
      }

      const sportBreakdown = Object.entries(sportMap).map(([name, value]) => ({ name, value }));

      setSummary({
        totalTime: weeklyVolume.reduce((a, b) => a + b, 0),
        weeklyVolume,
        sportBreakdown,
        consistency: `${completedSessions} sessions this week`,
      });
    };

    fetchData();
  }, [userId]);

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <h2 className="text-lg font-semibold mb-2">Weekly Summary</h2>
      <p className="text-sm text-gray-600 mb-2">Total Time: {summary.totalTime.toFixed(1)} hrs</p>
      <p className="text-sm text-gray-600 mb-4">{summary.consistency}</p>
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
