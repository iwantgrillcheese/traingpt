'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@/types/session';
import CalendarShell from './CalendarShell';

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      const supabase = createClientComponentClient();
      const {
        data: { session: authSession },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !authSession?.user) {
        console.error('Auth error or no user:', authError);
        return;
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', authSession.user.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching sessions:', error.message);
      } else {
        setSessions(data as Session[]);
      }

      setLoading(false);
    };

    fetchSessions();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading your training plan...</div>;
  }

  return <CalendarShell sessions={sessions} />;
}
