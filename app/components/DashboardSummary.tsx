'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, startOfWeek } from 'date-fns';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Bike, Run

type SportCategory = 'Swim' | 'Ride' | 'Run';

const displayMap: Record<SportCategory, string> = {
  Swim: 'Swim',
  Ride: 'Bike',
  Run: 'Run',
};

export default function DashboardSummary() {
  const [summary, setSummary] = useState<{
    totalTime: number;
    weeklyVolume: number[];
    sportBreakdown: { name: string; value: number }[];
    consistency: string;
  }>({
    totalTime: 0,
    weeklyVolume: [],
    sportBreakdown: [],
    consistency: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/strava_sync');
      const { data } = await res.json();

      const totals: Record<SportCategory, number> = {
        Swim: 0,
        Ride: 0,
        Run: 0,
      };

      const activeDays = new Set<string>();
      const weeks: Record<string, number> = {};

      data.forEach((a: any) => {
        const hours = a.moving_time / 3600;
        const sport = a.sport_type as SportCategory;
        if (sport in totals) {
          totals[sport] += hours;
        }

        const dateKey = format(new Date(a.start_date_local), 'yyyy-MM-dd');
        activeDays.add(dateKey);

        const weekKey = format(startOfWeek(new Date(a.start_date_local)), 'yyyy-MM-dd');
        weeks[weekKey] = (weeks[weekKey] || 0) + hours;
      });

      const weeklyVolume = Object.values(weeks).slice(-4); // last 4 weeks

      setSummary({
        totalTime: Object.values(totals).reduce((a, b) => a + b, 0),
        weeklyVolume,
        sportBreakdown: Object.entries(totals).map(([key, value]) => ({
          name: displayMap[key as SportCategory],
          value,
        })),
        consistency: `${activeDays.size} of last 7 days`,
      });
    };

    fetchData();
  }, []);

  return (
    <section className="mt-10 mb-4">
      <h2 className="text-lg font-semibold mb-2">Training Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Time and Consistency */}
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
          <p className="text-xl font-bold text-gray-800">{summary.totalTime.toFixed(1)}h</p>
        </div>

        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Training Consistency</p>
          <p className="text-xl font-bold text-gray-800">{summary.consistency}</p>
        </div>

        {/* Weekly Volume */}
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

        {/* Sport Breakdown */}
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
                  label
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
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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
