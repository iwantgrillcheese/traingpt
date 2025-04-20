// CoachingDashboard.tsx
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

  const fetchPlanAndSessions = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: plans } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!plans) return;
    const parsed = plans.plan?.plan;
    setPlan(parsed);
    setRaceDate(plans.race_date || null);
    setRaceType(plans.race_type || null);

    const storedActivation = localStorage.getItem('trainGPTActivated');
    if (storedActivation === 'true') setActivated(true);

    const { data: completed } = await supabase
      .from('completed_sessions')
      .select('*')
      .eq('user_id', session.user.id);

    let swim = 0, bike = 0, run = 0, total = 0;
    let maxMin = 0;
    let longest = '';
    let completedCount = 0, plannedCount = 0;

    const today = new Date();
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const upcoming: { date: string; label: string; status: string }[] = [];

    parsed.forEach((week: any, wIdx: number) => {
      const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), wIdx * 7);

      daysOfWeek.forEach((day, dIdx) => {
        const sessions = week.days?.[day] || [];
        const sessionList = Array.isArray(sessions) ? sessions : [sessions];
        const sessionDate = addDays(weekStart, dIdx);
        const sessionDateStr = sessionDate.toISOString().split('T')[0];

        sessionList.forEach((s: string) => {
          const completedSession = completed?.find((item) => item.date === sessionDateStr && item.sport.toLowerCase() === s.toLowerCase());
          const status = completedSession?.status || 'none';

          if (sessionDate <= addDays(today, 0)) {
            if (!s.toLowerCase().includes('rest')) plannedCount++;
            if (status === 'done') {
              completedCount++;
              const sLower = s.toLowerCase();
              if (sLower.includes('swim')) swim += 0.75;
              else if (sLower.includes('bike')) bike += 1.2;
              else if (sLower.includes('run')) run += 0.9;

              const timeMatch = s.match(/(\d+)(h|hr|hrs)?\s?(\d+)?(min)?/i);
              if (timeMatch) {
                const minTotal = (parseInt(timeMatch[1]) || 0) * 60 + (parseInt(timeMatch[3]) || 0);
                if (minTotal > maxMin) {
                  maxMin = minTotal;
                  longest = s;
                }
              }
            }
          }

          if (isAfter(sessionDate, today)) {
            upcoming.push({
              date: sessionDate.toDateString(),
              label: `${day}: ${s}`,
              status
            });
          }
        });
      });
    });

    total = swim + bike + run;
    setWeeklyStats({ swim: +swim.toFixed(1), bike: +bike.toFixed(1), run: +run.toFixed(1), total: +total.toFixed(1), longest: longest || 'N/A' });
    setCompliance(plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0);
    setUpcomingSessions(upcoming.slice(0, 5));
  };

  useEffect(() => {
    fetchPlanAndSessions();
  }, []);

  const daysLeft = raceDate ? differenceInCalendarDays(new Date(raceDate), new Date()) : null;

  const askCoach = async () => {
    if (!userQuestion) return;
    setFeedbackLoading(true);

    try {
      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        body: JSON.stringify({
          completedSessions: plan.flatMap((week) => Object.entries(week.days || {}).flatMap(([day, val]) => Array.isArray(val) ? val.map(v => `${day}: ${v}`) : [`${day}: ${val}`])),
          raceType,
          experienceLevel,
          userNote: userQuestion,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setCoachNote(data.feedback);
    } catch (err) {
      console.error(err);
      alert('Error asking coach.');
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (!plan.length) return <div className="text-center text-gray-500 py-20">Generate and finalize a plan first.</div>;
  if (!activated) {
    return (
      <div className="max-w-xl mx-auto text-center py-32 px-4">
        <h2 className="text-2xl font-semibold mb-4">Activate AI Coaching</h2>
        <p className="text-gray-600 mb-6">Get race countdowns, compliance stats, and weekly feedback tailored to your plan.</p>
        <button
          onClick={() => {
            setActivated(true);
            localStorage.setItem('trainGPTActivated', 'true');
          }}
          className="px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition"
        >✅ Yes, activate coaching</button>
      </div>
    );
  }

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

      <div className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Ask Your Coach</h2>
        <textarea
          className="w-full border rounded-lg p-3 text-sm bg-white shadow-sm"
          rows={3}
          placeholder="e.g. 'What drills should I do Monday?' or 'How hard should I push on Tuesday’s bike ride?'"
          value={userQuestion}
          onChange={(e) => setUserQuestion(e.target.value)}
        />
        <button
          onClick={askCoach}
          disabled={feedbackLoading}
          className={`mt-3 px-5 py-2 rounded-full text-sm flex items-center justify-center transition ${feedbackLoading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'}`}
        >
          {feedbackLoading ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Ask Coach'}
        </button>
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
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{coachNote || 'Ask a question to generate some coach notes.'}</p>
      </div>
    </main>
  );
}
