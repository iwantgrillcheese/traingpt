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
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.warn('⚠️ No Supabase user session found');
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);

      if (sessionData) setSessions(sessionData);

      const { data: stravaData } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);

      if (stravaData) setStravaActivities(stravaData);

      const { data: plan } = await supabase
        .from('plans')
        .select('start_date')
        .eq('user_id', user.id)
        .single();

      if (plan?.start_date) setPlanStartDate(plan.start_date);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-zinc-400">Loading your training data...</div>;
  }

  const enrichedSessions = mergeSessionsWithStrava(sessions, stravaActivities);

  return (
    <div>
      <CalendarShell sessions={enrichedSessions} />
    </div>
  );
}
