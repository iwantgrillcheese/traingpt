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
  console.log('[DashboardSummary] Component mounted');

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
    console.log('[DashboardSummary] useEffect running');

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
        const data = Array.isArray(json.data) ? json.data : [];
        console.log('[Strava Dashboard Raw Data]', data);

        // Stop here just to confirm loop runs at all
        if (data.length === 0) {
          console.warn('[DashboardSummary] No activity data returned');
        }

        data.forEach((a: any) => {
          console.log('[ACTIVITY]', {
            name: a.name,
            sport_type: a.sport_type,
            start_date_local: a.start_date_local,
            start_date: a.start_date,
          });
        });

        // We won't update state for now — just proving logs fire
      } catch (err) {
        console.error('[DashboardSummary] Unexpected error:', err);
      }
    };

    fetchData();
  }, []);

  return (
    <section className="mt-10 mb-4">
      <h2 className="text-lg font-semibold mb-2">Training Summary</h2>
      <p className="text-sm text-gray-500">Debug mode active. Check console logs.</p>
    </section>
  );
}
