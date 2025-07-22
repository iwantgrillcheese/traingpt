// ✅ CoachingDashboard.tsx (fully patched)

'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  format,
  formatDistanceToNow,
  parseISO,
  isAfter,
  subDays,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import Link from 'next/link';
import { useMediaQuery } from 'react-responsive';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { fetchGPTSummary } from '@/utils/fetchGPTSummary';

const supabase = createClientComponentClient();
const COLORS = ['#60A5FA', '#34D399', '#FBBF24'];
const validSports = ['Swim', 'Bike', 'Run'] as const;
type Sport = (typeof validSports)[number];

type ChatMessage = {
  role: string;
  content: string;
  timestamp: number;
  error?: boolean;
};

export default function CoachingDashboard({ userId }: { userId: string }) {
  const [weeklySummary, setWeeklySummary] = useState<string | null>(null);
  const [stravaData, setStravaData] = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const today = new Date();

  useEffect(() => {
    const fetchData = async () => {
      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('sport, avg_power, avg_hr, date, distance_km')
        .eq('user_id', userId)
        .gte('date', startOfDay(subDays(today, 28)).toISOString());

      if (stravaData) setStravaData(stravaData);

      setLoadingSummary(true);
      const res = await fetch('/api/weekly-summary');
const { summary } = await res.json();
      setWeeklySummary(summary);
      setLoadingSummary(false);
    };

    fetchData();
  }, [userId]);

  const WeeklySummaryPanel = () => (
    <section className="my-6">
      <h2 className="text-lg font-semibold mb-2">Coach’s Weekly Summary</h2>
      <div className="border rounded-xl p-4 bg-white shadow-sm">
        {loadingSummary ? (
          <p className="text-sm text-gray-500 italic">Generating summary...</p>
        ) : weeklySummary ? (
          <p className="text-sm whitespace-pre-line text-gray-800">{weeklySummary}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">No summary available. Try again later.</p>
        )}
      </div>
    </section>
  );

  const DashboardSummary = () => {
    if (!stravaData || stravaData.length === 0) return null;

    const weeklyVolume = [0, 0, 0, 0];
    const sportTotals: Record<Sport, number> = { Swim: 0, Bike: 0, Run: 0 };
    const uniqueDays = new Set<string>();
    const sevenDaysAgo = subDays(today, 6);
    const startOfThisWeek = startOfDay(startOfWeek(today));

    for (const activity of stravaData) {
      const date = parseISO(activity.date);
      const weekStart = startOfDay(startOfWeek(date));
      const weekDiff = Math.floor((startOfThisWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const hours = 1; // estimate

      if (weekDiff >= 0 && weekDiff < 4) {
        weeklyVolume[3 - weekDiff] += hours;
      }

      if (weekDiff === 0 && validSports.includes(activity.sport)) {
        sportTotals[activity.sport as Sport] += hours;
      }

      if (date >= startOfDay(sevenDaysAgo) && date <= today) {
        uniqueDays.add(format(date, 'yyyy-MM-dd'));
      }
    }

    const totalTime = Object.values(sportTotals).reduce((a, b) => a + b, 0);
    const chartData = Object.entries(sportTotals).map(([name, value]) => ({ name, value }));

    const formatDuration = (hours: number): string => {
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      if (wholeHours === 0 && minutes > 0) return `${minutes} mins`;
      if (wholeHours > 0 && minutes > 0) return `${wholeHours}h ${minutes}m`;
      return `${wholeHours}h`;
    };

    return (
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Training Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
            <p className="text-xl font-bold text-gray-800">{formatDuration(totalTime)}</p>
          </div>
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Training Consistency</p>
            <p className="text-xl font-bold text-gray-800">{uniqueDays.size} of last 7 days</p>
          </div>
          <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
            <p className="text-sm text-gray-500 mb-2">Weekly Volume (hrs)</p>
            <div className="flex items-end gap-2 h-20">
              {weeklyVolume.map((val, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className="bg-blue-500 w-4 rounded"
                    style={{ height: `${val * 10}px` }}
                    title={`${val.toFixed(1)} hrs`}
                  />
                  <span className="text-[10px] text-gray-500 mt-1">W{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
            <p className="text-sm text-gray-500 mb-2">Sport Breakdown</p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({ name, value }) => `${name}: ${formatDuration(value as number)}`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className="flex flex-col min-h-screen max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <WeeklySummaryPanel />
      <DashboardSummary />
    </main>
  );
}