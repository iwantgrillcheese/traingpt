'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, startOfDay, endOfDay } from 'date-fns';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Ride, Run
type SportCategory = 'Swim' | 'Ride' | 'Run';

const categoryMap: Record<string, SportCategory | null> = {
  swim: 'Swim',
  ride: 'Ride',
  virtualride: 'Ride',
  run: 'Run',
};

export default function DashboardSummary() {
  const [summary, setSummary] = useState<{
    totalTime: number;
    weeklyVolume: number[];
    sportBreakdown: { name: SportCategory; value: number }[];
    consistency: string;
  }>({
    totalTime: 0,
    weeklyVolume: [],
    sportBreakdown: [],
    consistency: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      console.log('[DashboardSummary] Fetch starting...');
  
      try {
        const res = await fetch('/api/strava_sync');
        console.log('[DashboardSummary] Response status:', res.status);
  
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[DashboardSummary] Fetch failed:', errorText);
          return;
        }
  
        const json = await res.json();
        console.log('[Strava Dashboard Raw Data]', json);
  
        const data = Array.isArray(json.data) ? json.data : [];
        const totals: Record<SportCategory, number> = {
          Swim: 0,
          Ride: 0,
          Run: 0,
        };
  
        const activeDays = new Set<string>();
        const weekBuckets: Record<string, number> = {};
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);
  
        data.forEach((a: any) => {
          const rawType = (a.sport_type ?? '').trim().toLowerCase();
          const mapped = categoryMap[rawType] ?? null;
          if (!mapped) return;
  
          const activityDate = new Date(a.start_date_local || a.start_date);
          const dateKey = format(activityDate, 'yyyy-MM-dd');
          const weekKey = format(startOfWeek(activityDate), 'yyyy-MM-dd');
          const hours = a.moving_time / 3600;
  
          if (
            activityDate >= startOfDay(sevenDaysAgo) &&
            activityDate <= endOfDay(today)
          ) {
            totals[mapped] += hours;
            activeDays.add(dateKey);
          }
  
          weekBuckets[weekKey] = (weekBuckets[weekKey] || 0) + hours;
        });
  
        // ✅ Sort weeks chronologically before slicing
        const weeklyVolume = Object.entries(weekBuckets)
          .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
          .slice(-4)
          .map(([, value]) => parseFloat(value.toFixed(1)));
  
        console.log('[DashboardSummary] Totals:', totals);
        console.log('[DashboardSummary] Active Days:', Array.from(activeDays));
        console.log('[DashboardSummary] Weekly Volume:', weeklyVolume);
  
        setSummary({
          totalTime: parseFloat(
            Object.values(totals).reduce((a, b) => a + b, 0).toFixed(1)
          ),
          weeklyVolume,
          sportBreakdown: (['Swim', 'Ride', 'Run'] as SportCategory[]).map((sport) => ({
            name: sport,
            value: parseFloat(totals[sport].toFixed(1)),
          })),
          consistency: `${activeDays.size} of last 7 days`,
        });
      } catch (err) {
        console.error('[DashboardSummary] Unexpected error:', err);
      }
    };
  
    fetchData();
  }, []);  

  return (
    <section className="mt-10 mb-4">
      <h2 className="text-lg font-semibold mb-2">Training Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
          <p className="text-xl font-bold text-gray-800">{summary.totalTime.toFixed(1)}h</p>
        </div>

        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Training Consistency</p>
          <p className="text-xl font-bold text-gray-800">{summary.consistency}</p>
        </div>

        <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
          <p className="text-sm text-gray-500 mb-2">Weekly Volume (hrs)</p>
          <div className="flex items-end gap-2 h-20">
            {summary.weeklyVolume.map((val, i) => (
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
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={summary.sportBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={30}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {summary.sportBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="text-sm text-gray-700 mt-2 sm:mt-0">
              {summary.sportBreakdown.map((s, i) => (
                <li key={i} className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span>{s.name}</span>
                  <span className="text-gray-500 ml-2">{s.value.toFixed(1)}h</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
