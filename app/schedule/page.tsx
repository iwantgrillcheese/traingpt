// app/schedule/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CalendarShell from './CalendarShell';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [planStartDate, setPlanStartDate] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get sessions
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);

      if (!sessionData) return;

      setSessions(sessionData);

      // Get Strava activities
      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);

      if (stravaData) setStravaActivities(stravaData);

      // Get plan for start_date
      const { data: plan } = await supabase
        .from('plans')
        .select('start_date')
        .eq('user_id', user.id)
        .single();

      if (plan?.start_date) setPlanStartDate(plan.start_date);
    };

    fetchData();
  }, []);

  const enrichedSessions = mergeSessionsWithStrava(sessions, stravaActivities);

  return (
    <div>
      <CalendarShell sessions={enrichedSessions} />
    </div>
  );
}
