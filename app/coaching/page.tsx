'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import CoachingDashboard from '../components/CoachingDashboard';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { useStravaAutoSync } from '../hooks/useStravaAutoSync';

type CompletedSession = {
  id?: string;
  user_id: string;
  date?: string;
  session_date?: string;
  session_title?: string;
  title?: string;
  strava_id?: string;
};

export default function CoachingPage() {
  useStravaAutoSync(); // ✅ Auto-trigger Strava sync on load

  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<number[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);
  const [stravaConnected, setStravaConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        console.error('supabase.auth.getUser error:', userErr);
        return;
      }
      if (!user) return;

      if (cancelled) return;
      setUserId(user.id);

      const [sessionsRes, completedRes, stravaRes, profileRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .returns<Session[]>(),
        supabase
          .from('completed_sessions')
          .select('*')
          .eq('user_id', user.id)
          .returns<CompletedSession[]>(),
        supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', user.id)
          .returns<StravaActivity[]>(),
        supabase.from('profiles').select('strava_access_token').eq('id', user.id).single(),
      ]);

      if (sessionsRes.error) console.error('sessionsRes error:', sessionsRes.error);
      if (completedRes.error) console.error('completedRes error:', completedRes.error);
      if (stravaRes.error) console.error('stravaRes error:', stravaRes.error);
      if (profileRes.error) console.error('profileRes error:', profileRes.error);

      if (cancelled) return;

      setSessions(sessionsRes.data ?? []);
      setCompletedSessions(completedRes.data ?? []);
      setStravaActivities(stravaRes.data ?? []);
      setStravaConnected(!!profileRes.data?.strava_access_token);

      try {
        const summaryRes = await fetch('/api/weekly-summary');
        const summaryJson = await summaryRes.json();
        if (cancelled) return;

        setWeeklyVolume(summaryJson?.weeklyVolume ?? []);
        setWeeklySummary(summaryJson ?? null);
      } catch (e) {
        console.error('weekly-summary fetch failed:', e);
        if (!cancelled) {
          setWeeklyVolume([]);
          setWeeklySummary(null);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!userId || !weeklySummary) return null;

  return (
    <CoachingDashboard
      userId={userId}
      sessions={sessions}
      completedSessions={completedSessions as any} // see note below
      stravaActivities={stravaActivities}
      weeklyVolume={weeklyVolume}
      weeklySummary={weeklySummary}
      stravaConnected={stravaConnected}
    />
  );
}
