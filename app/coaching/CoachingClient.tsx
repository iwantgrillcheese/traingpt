'use client';

import { useEffect, useState } from 'react';
import CoachingDashboard from '../components/CoachingDashboard';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';
import { getWeeklySummary, WeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';
import { supabase } from '@/utils/supabaseClient';

export default function CoachingClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [weeklyVolume, setWeeklyVolume] = useState<number[]>([]);
  const [stravaConnected, setStravaConnected] = useState(false);


  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);
      const fetchedSessions = sessionData || [];
      setSessions(fetchedSessions);

      const { data: completedData } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', user.id);
      const fetchedCompleted = completedData || [];
      setCompletedSessions(fetchedCompleted);

      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);
      const fetchedStrava = stravaData || [];
      setStravaActivities(fetchedStrava);

      // Compute summary and volume
      const summary = getWeeklySummary(fetchedSessions, fetchedCompleted, fetchedStrava);
      const volume = getWeeklyVolume(fetchedSessions, fetchedCompleted, fetchedStrava);
      setWeeklySummary(summary);
      setWeeklyVolume(volume);
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
  stravaConnected={stravaConnected}
/>
  );
}
