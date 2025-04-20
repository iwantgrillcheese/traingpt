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
    const parsed = plans.plan;
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

  ...
