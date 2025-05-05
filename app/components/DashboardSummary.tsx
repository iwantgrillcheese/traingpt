'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24']; // Blue, Green, Yellow

export default function DashboardSummary() {
  const [fakeData, setFakeData] = useState({
    totalTime: '5h 40m',
    weeklyVolume: [3.2, 4.5, 6.0, 5.7],
    sportBreakdown: [
      { name: 'Swim', value: 1.0 },
      { name: 'Bike', value: 3.0 },
      { name: 'Run', value: 1.7 },
    ],
    consistency: '5 of last 7 days',
  });

  return (
    <section className="mt-10 mb-4">
      <h2 className="text-lg font-semibold mb-2">Training Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Time and Consistency */}
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
          <p className="text-xl font-bold text-gray-800">{fakeData.totalTime}</p>
        </div>

        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Training Consistency</p>
          <p className="text-xl font-bold text-gray-800">{fakeData.consistency}</p>
        </div>

        {/* Weekly Volume */}
        <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
          <p className="text-sm text-gray-500 mb-2">Weekly Volume (hrs)</p>
          <div className="flex items-end gap-2 h-20">
            {fakeData.weeklyVolume.map((val, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="bg-blue-500 w-4 rounded"
                  style={{ height: `${val * 10}px` }}
                  title={`${val} hrs`}
                />
                <span className="text-[10px] text-gray-500 mt-1">W{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sport Breakdown Pie */}
        <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
          <p className="text-sm text-gray-500 mb-2">Sport Breakdown</p>
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={fakeData.sportBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={30}
                  label
                >
                  {fakeData.sportBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="text-sm text-gray-700 mt-2 sm:mt-0">
              {fakeData.sportBreakdown.map((s, i) => (
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
