'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';

const supabase = createClientComponentClient();

const getColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes('interval') || s.includes('brick') || s.includes('race pace')) return 'bg-red-400';
  if (s.includes('threshold') || s.includes('tempo') || s.includes('z3')) return 'bg-yellow-400';
  return 'bg-green-400';
};

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: plans } = await supabase
          .from('plans')
          .select('plan, race_date, coach_note')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: completedSessions } = await supabase
          .from('completed_sessions')
          .select('date, sport, status');

        const { data: activities } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', session.user.id);

        const checks: { [key: string]: string } = {};
        completedSessions?.forEach(({ date, sport, status }) => {
          checks[`${date}-${sport}`] = status;
        });

        if (plans) {
          setPlan(plans.plan || []);
          setRaceDate(plans.race_date || null);
          setCoachNote(plans.coach_note || null);
        }
        setCompleted(checks);
        setStravaActivities(activities || []);
      } catch (e) {
        console.error('[DATA_FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const today = new Date();
  const raceCountdown = raceDate ? Math.max(0, Math.floor((parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : null;

  if (loading) {
    return <div className="py-32 text-center text-gray-400">Loading your schedule...</div>;
  }

  if (!plan.length) {
    return <div className="py-32 text-center text-gray-400">No plan found. Generate one to get started.</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
      {/* Top Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">Your Training Plan</h1>
        {raceCountdown !== null && (
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-6 mt-2">
            <div
              className="absolute left-0 top-0 h-full bg-black transition-all"
              style={{ width: `${Math.max(0, 100 - (raceCountdown / 100) * 100)}%` }}
            />
          </div>
        )}
        {coachNote && (
          <p className="text-md sm:text-lg text-gray-600 italic">{coachNote}</p>
        )}
      </div>

      {/* Plan grid will come here next */}
