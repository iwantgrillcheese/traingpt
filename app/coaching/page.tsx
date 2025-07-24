// app/coaching/page.tsx
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

      // Fetch sessions
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);
      setSessions(sessionData || []);

      // Fetch completed sessions
      const { data: completedData } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', user.id);
      setCompletedSessions(completedData || []);

      // Fetch Strava activities
      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);
      setStravaActivities(stravaData || []);

      // Weekly summary
      const summaryRes = await fetch(`/api/weekly-summary?userId=${user.id}`);
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
