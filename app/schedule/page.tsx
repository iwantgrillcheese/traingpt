'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CalendarShell from './CalendarShell';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';
import Footer from '../components/footer';

type CompletedSession = {
  session_date: string;
  session_title: string;
  strava_id?: string;
};

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
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

      const [{ data: sessionData }, { data: stravaData }, { data: completedData }] =
        await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
        ]);

      if (sessionData) setSessions(sessionData);
      if (stravaData) setStravaActivities(stravaData);
      if (completedData) setCompletedSessions(completedData);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-zinc-400">Loading your training data...</div>;
  }

  const { merged: enrichedSessions, unmatched: unmatchedActivities } = mergeSessionsWithStrava(
    sessions,
    stravaActivities
  );

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <CalendarShell
          sessions={enrichedSessions}
          completedSessions={completedSessions}
          stravaActivities={stravaActivities}
          extraStravaActivities={unmatchedActivities}
        />
      </main>
      <Footer />
    </div>
  );
}
