'use client';

import { useEffect, useState } from 'react';
import CoachingDashboard from '../components/CoachingDashboard';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { getWeeklySummary, WeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';
import { supabase } from '@/utils/supabaseClient';

export default function CoachingClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);
      if (sessionData) setSessions(sessionData);

      const { data: completedData } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', user.id);
      if (completedData) setCompletedSessions(completedData);

      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);
      if (stravaData) setStravaActivities(stravaData);
    };

    fetchData();
  }, []);

  if (!userId) return null;

  const weeklySummary: WeeklySummary = getWeeklySummary(sessions, completedSessions, stravaActivities);
  const weeklyVolume: number[] = getWeeklyVolume(sessions, completedSessions, stravaActivities);

  return (
    <CoachingDashboard
      userId={userId}
      sessions={sessions}
      completedSessions={completedSessions}
      stravaActivities={stravaActivities}
      weeklySummary={weeklySummary}
      weeklyVolume={weeklyVolume}
    />
  );
}
