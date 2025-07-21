'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import CalendarShell from './CalendarShell';
import { mergeSessionsWithStrava } from '@/utils/mergeSessionWithStrava';

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClientComponentClient();
      const {
        data: { session: authSession },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !authSession?.user) {
        console.error('Auth error or no user:', authError);
        return;
      }

      const [sessionsRes, stravaRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('user_id', authSession.user.id)
          .order('date', { ascending: true }),
        supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', authSession.user.id),
      ]);

      if (sessionsRes.error) {
        console.error('Error fetching sessions:', sessionsRes.error.message);
      } else {
        setSessions(sessionsRes.data as Session[]);
      }

      if (stravaRes.error) {
        console.error('Error fetching strava:', stravaRes.error.message);
      } else {
        setStravaActivities(stravaRes.data as StravaActivity[]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading your training plan...</div>;
  }

  const merged = mergeSessionsWithStrava(sessions, stravaActivities);

  return <CalendarShell sessions={merged} />;
}
