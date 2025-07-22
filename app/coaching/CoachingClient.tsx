// app/coaching/CoachingClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoachingDashboard from '../components/CoachingDashboard';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

export default function CoachingClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);

      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);

      if (sessionData) setSessions(sessionData);
      if (stravaData) setStravaActivities(stravaData);
    };
    fetchData();
  }, []);

  if (!userId) return null;

  return (
<CoachingDashboard userId={userId} />
  );
}
