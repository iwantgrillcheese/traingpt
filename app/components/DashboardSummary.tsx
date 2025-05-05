// components/DashboardSummary.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DashboardSummary() {
  const [fakeData, setFakeData] = useState({
    totalTime: '5h 40m',
    weeklyVolume: [3.2, 4.5, 6.0, 5.7],
    sportBreakdown: {
      Swim: 1.0,
      Bike: 3.0,
      Run: 1.7,
    },
    consistency: '5 of last 7 days',
  });

  return (
    <section className="mt-10 mb-4">
      <h2 className="text-lg font-semibold mb-2">Training Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
          <p className="text-xl font-bold text-gray-800">{fakeData.totalTime}</p>
        </div>

        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Training Consistency</p>
          <p className="text-xl font-bold text-gray-800">{fakeData.consistency}</p>
        </div>

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

        <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
          <p className="text-sm text-gray-500 mb-2">Sport Breakdown</p>
          <div className="flex gap-6 text-sm">
            {Object.entries(fakeData.sportBreakdown).map(([sport, time]) => (
              <div key={sport} className="flex items-center gap-2">
                <span className="font-medium text-gray-700">{sport}</span>
                <span className="text-gray-500">{time}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
