'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, isWithinInterval, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Swim, Bike, Run

export default function DashboardSummary() {
  const [summary, setSummary] = useState<{
    totalHours: number;
    weeklyVolume: { label: string; hours: number }[];
    sportBreakdown: { name: string; value: number }[];
    consistency: string;
  }>({
    totalHours: 0,
    weeklyVolume: [],
    sportBreakdown: [],
    consistency: '',
  });

  useEffect(() => {
    fetch('/api/strava_sync')
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;

        const now = new Date();
        const totals = { Swim: 0, Bike: 0, Run: 0 };
        const activeDays = new Set<string>();

        data.forEach((a: any) => {
          const hours = a.moving_time / 3600;
          if (totals[a.sport_type] !== undefined) {
            totals[a.sport_type] += hours;
          }
          activeDays.add(format(new Date(a.start_date_local), 'yyyy-MM-dd'));
        });

        const pastWeekDays = Array.from(activeDays).filter(d =>
          isWithinInterval(new Date(d), {
            start: subDays(now, 6),
            end: now,
          })
        );

        const totalHours = Object.values(totals).reduce((sum, h) => sum + h, 0);

        const weeklyVolume = [0, 1, 2, 3].map(i => {
          const start = startOfWeek(subWeeks(now, i));
          const end = endOfWeek(start);
          const total = data
            .filter((a: any) =>
              isWithinInterval(new Date(a.start_date), { start, end })
            )
            .reduce((sum, a: any) => sum + a.moving_time, 0);

          return { label: `W${4 - i}`, hours: +(total / 3600).toFixed(1) };
        }).reverse();

        setSummary({
          totalHours: +totalHours.toFixed(1),
          weeklyVolume,
          sportBreakdown: [
            { name: 'Swim', value: +totals.Swim.toFixed(1) },
            { name: 'Bike', value: +totals.Bike.toFixed(1) },
            { name: 'Run', value: +totals.Run.toFixed(1) },
          ],
          consistency: `${pastWeekDays.length} of last 7 days`,
        });
      });
  }, []);

  return (
    <section className="mt-10 mb-4">
      <h2 className="text-lg font-semibold mb-2">Training Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Time */}
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
          <p className="text-xl font-bold text-gray-800">{summary.totalHours}h</p>
        </div>

        {/* Consistency */}
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
                  style={{ height: `${val.hours * 10}px` }}
                  title={`${val.hours} hrs`}
                />
                <span className="text-[10px] text-gray-500 mt-1">{val.label}</span>
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
                  <span className="text-gray-500 ml-2">{s.value}h</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
