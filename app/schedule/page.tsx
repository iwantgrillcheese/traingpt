'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import CalendarShell from './CalendarShell';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import mergeSessionsWithStrava, { MergedSession } from '@/utils/mergeSessionWithStrava';
import Footer from '../components/footer';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        const [sessionsRes, stravaRes, completedRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('strava_activities').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (stravaRes.error) throw stravaRes.error;
        if (completedRes.error) throw completedRes.error;

        if (cancelled) return;

        setSessions((sessionsRes.data ?? []) as Session[]);
        setStravaActivities((stravaRes.data ?? []) as StravaActivity[]);

        const normalizedCompleted: CompletedSession[] = (completedRes.data ?? []).map((c: any) => ({
          date: c.date || c.session_date,
          session_title: c.session_title || c.title,
          strava_id: c.strava_id,
        }));

        setCompletedSessions(normalizedCompleted);
        setLoading(false);
      } catch (e: any) {
        console.error('SchedulePage fetchData error:', e);
        if (!cancelled) {
          setLoadError(e?.message ?? 'Failed to load schedule data.');
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCompletedUpdate = useCallback((updated: CompletedSession[]) => {
    setCompletedSessions(updated);
  }, []);

  const { enrichedSessions, unmatchedActivities } = useMemo(() => {
    try {
      const { merged, unmatched } = mergeSessionsWithStrava(
        sessions,
        stravaActivities,
        DEFAULT_TIMEZONE
      );
      return { enrichedSessions: merged, unmatchedActivities: unmatched };
    } catch (e) {
      console.error('mergeSessionsWithStrava failed:', e);
      return {
        enrichedSessions: sessions as unknown as MergedSession[],
        unmatchedActivities: [] as StravaActivity[],
      };
    }
  }, [sessions, stravaActivities]);

  if (loading) {
    return <div className="text-center py-10 text-zinc-400">Loading your training data...</div>;
  }

  if (loadError) {
    return (
      <div className="text-center py-10 text-zinc-400">
        <div className="text-sm">Something went wrong loading your schedule.</div>
        <div className="mt-2 text-xs text-zinc-500">{loadError}</div>
      </div>
    );
  }

  const isLoggedOut = enrichedSessions.length === 0 && stravaActivities.length === 0;

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {isLoggedOut ? (
          <div className="text-center py-10 text-zinc-400">Please sign in to view your schedule.</div>
        ) : (
          <CalendarShell
            sessions={enrichedSessions}
            completedSessions={completedSessions}
            stravaActivities={stravaActivities}
            extraStravaActivities={unmatchedActivities}
            onCompletedUpdate={handleCompletedUpdate}
            timezone={DEFAULT_TIMEZONE}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
