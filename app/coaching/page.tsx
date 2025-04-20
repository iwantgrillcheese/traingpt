"use client";

import { useEffect, useState } from 'react';
import { differenceInCalendarDays, startOfWeek, addDays, isAfter } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CoachingDashboard() {
  const supabase = createClientComponentClient();
  const [plan, setPlan] = useState<any[]>([]);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [raceType, setRaceType] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string>('intermediate');
  const [activated, setActivated] = useState(false);
  const [coachNote, setCoachNote] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState({ total: 0, swim: 0, bike: 0, run: 0, longest: '' });
  const [compliance, setCompliance] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState<{ date: string; label: string; status: string }[]>([]);

  useEffect(() => {
    const fetchPlan = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: planRow } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!planRow?.plan?.length) return;

      const storedActivation = localStorage.getItem('trainGPTActivated');
      if (storedActivation === 'true') setActivated(true);

      const parsed = planRow.plan;
      setPlan(parsed);
      setRaceDate(planRow.race_date || null);
      setRaceType(planRow.race_type || null);

      const { data: completed } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', session.user.id);

      let swim = 0, bike = 0, run = 0, total = 0;
      let maxMin = 0;
      let longest = '';
      let completedCount = 0, plannedCount = 0;

      const today = new Date();
      const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const upcoming: { date: string; label: string; status: string }[] = [];

      parsed.forEach((week, i) => {
        const start = addDays(startOfWeek(today, { weekStartsOn: 1 }), i * 7);

        days.forEach((day, d) => {
          const sessionDate = addDays(start, d);
          const sessionDateStr = sessionDate.toISOString().split('T')[0];
          const sessions = Array.isArray(week.days?.[day]) ? week.days[day] : [];

          sessions.forEach((s: string) => {
            const status = completed?.find((c) => c.date === sessionDateStr && s.toLowerCase().includes(c.sport))?.status || 'none';
            if (!s.toLowerCase().includes('rest')) plannedCount++;
            if (status === 'done') {
              completedCount++;
              const lower = s.toLowerCase();
              if (lower.includes('swim')) swim += 0.75;
              else if (lower.includes('bike')) bike += 1.2;
              else if (lower.includes('run')) run += 0.9;

              const time = s.match(/(\d+)(?:hr|h)?(?:\s?(\d+))?min?/i);
              if (time) {
                const min = (parseInt(time[1]) || 0) * 60 + (parseInt(time[2]) || 0);
                if (min > maxMin) { maxMin = min; longest = s; }
              }
            }
            if (isAfter(sessionDate, today)) {
              upcoming.push({ date: sessionDate.toDateString(), label: `${day}: ${s}`, status });
            }
          });
        });
      });

      total = swim + bike + run;
      setWeeklyStats({ swim: +swim.toFixed(1), bike: +bike.toFixed(1), run: +run.toFixed(1), total: +total.toFixed(1), longest: longest || 'N/A' });
      setCompliance(plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0);
      setUpcomingSessions(upcoming.slice(0, 5));
    };

    fetchPlan();
  }, []);

  const daysLeft = raceDate ? differenceInCalendarDays(new Date(raceDate), new Date()) : null;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
        <h1 className="text-2xl sm:text-3xl font-semibold">Coaching Dashboard</h1>
        <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 transition">🔄 Refresh</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Race Countdown</p>
          <p className="text-xl font-bold text-gray-900">{daysLeft !== null ? `${daysLeft} days to ${raceType || 'your race'}` : 'No race date'}</p>
        </div>
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">This Week’s Training Time</p>
          <p className="text-xl font-bold">{weeklyStats.total} hrs</p>
        </div>
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">This Week’s Compliance</p>
          <p className={`text-xl font-bold ${compliance === 100 ? 'text-green-600' : compliance === 0 ? 'text-red-500' : 'text-yellow-500'}`}>{compliance}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Swim</p>
          <p className="font-bold text-lg">{weeklyStats.swim} hrs</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Bike</p>
          <p className="font-bold text-lg">{weeklyStats.bike} hrs</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Run</p>
          <p className="font-bold text-lg">{weeklyStats.run} hrs</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Longest Session</p>
          <p className="font-bold text-lg">{weeklyStats.longest}</p>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Upcoming Sessions</h2>
        <p className="text-gray-500 mb-4">Here’s what’s coming up. Want more detail? Ask your coach above.</p>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {upcomingSessions.map((s, i) => (
            <div key={i} className="min-w-[220px] bg-white border rounded-xl p-4 shadow-sm shrink-0">
              <p className="text-xs text-gray-500 mb-1">{s.date}</p>
              <p className="text-sm font-medium text-gray-800">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <p className="text-sm text-gray-500 font-semibold mb-2">Coach Notes</p>
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">Ask a question to generate some coach notes. (Coming soon!)</p>
      </div>
    </main>
  );
}
