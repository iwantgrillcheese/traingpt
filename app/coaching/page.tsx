'use client';

import { useEffect, useState } from 'react';
import CoachingDashboard from '../components/CoachingDashboard';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';

export default function CoachingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<number[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch session data from Supabase
      const [{ data: sessionData }, { data: completedData }, { data: stravaData }] =
        await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
        ]);

      setSessions(sessionData || []);
      setCompletedSessions(completedData || []);
      setStravaActivities(stravaData || []);

      // Fetch computed summary from API
      const summaryRes = await fetch(`/api/weekly-summary`);
      const summary = await summaryRes.json();

      setWeeklyVolume(summary?.weeklyVolume || []);
      setWeeklySummary(summary || null);
    };

    fetchData();
  }, []);

  if (!userId || !weeklySummary) return null;

  return (
    <CoachingDashboard
      userId={userId}
      sessions={sessions}
      completedSessions={completedSessions}
      stravaActivities={stravaActivities}
      weeklyVolume={weeklyVolume}
      weeklySummary={weeklySummary}
    />
  );
}
