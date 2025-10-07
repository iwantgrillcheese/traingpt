'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CalendarShell from './CalendarShell';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';
import Footer from '../components/footer';
import { normalizeStravaActivities } from '@/utils/normalizeStravaActivities';
import { format } from 'date-fns';

// DB-aligned type for completed sessions
type CompletedSession = {
  date: string;
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

      if (completedData) {
        const normalized = completedData.map((c: any) => ({
          date: c.date || c.session_date,
          session_title: c.session_title || c.title,
          strava_id: c.strava_id,
        }));
        setCompletedSessions(normalized);
      }

      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const handleCompletedUpdate = useCallback((updated: CompletedSession[]) => {
    setCompletedSessions(updated);
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-zinc-400">Loading your training data...</div>;
  }

  const { merged: enrichedSessions, unmatched: unmatchedActivities } = mergeSessionsWithStrava(
    sessions,
    stravaActivities
  );

  // 🧩 Group sessions by date for MonthGrid
  const sessionsByDate: Record<string, Session[]> = {};
  for (const s of enrichedSessions) {
    const key = s.date ? format(new Date(s.date), 'yyyy-MM-dd') : '';
    if (!key) continue;
    if (!sessionsByDate[key]) sessionsByDate[key] = [];
    sessionsByDate[key].push(s);
  }

  // 🧩 Group Strava activities by date
const stravaByDate: Record<string, StravaActivity[]> = normalizeStravaActivities(stravaActivities);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
<CalendarShell
  sessionsByDate={sessionsByDate}
  completedSessions={completedSessions}
  stravaByDate={stravaByDate} // ✅ this must be the grouped object, not the array
  unmatchedActivities={unmatchedActivities}
  onCompletedUpdate={handleCompletedUpdate}
/>
      </main>
      <Footer />
    </div>
  );
}
