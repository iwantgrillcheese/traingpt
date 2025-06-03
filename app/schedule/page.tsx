'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay, startOfWeek } from 'date-fns';
import SessionCard from './SessionCard';
import RichCalendarView from './RichCalendarView';
import MobileCalendarView from './MobileCalendarView';
import { Session } from '@/types/session';


const supabase = createClientComponentClient();

type DisplaySession = Session & {
  isStravaOnly?: boolean;
  duration?: number;
};


export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [view, setView] = useState<'calendar' | 'schedule'>('calendar');
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});
  const [isMobile, setIsMobile] = useState(false);

  const today = new Date();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        setUserId(session.user.id);

        const { data: planData } = await supabase
          .from('plans')
          .select('id, coach_note, race_date')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!planData) return;

        setPlanId(planData.id);
        setCoachNote(planData.coach_note || null);
        setRaceDate(planData.race_date || null);

        const { data: sessionsData } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('plan_id', planData.id)
          .order('date');

        setSessions(sessionsData || []);

        const { data: activities } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', session.user.id);

        setStravaActivities(activities || []);
      } catch (e) {
        console.error('[DATA_FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const saveSessionStatus = async (sessionId: string, status: 'done' | 'skipped' | 'missed') => {
    const { error } = await supabase.from('sessions').update({ status }).eq('id', sessionId);
    if (error) console.error('[❌ Supabase save error]', error);

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status } : s))
    );
  };

  const groupedByWeek = useMemo(() => {
    const weeks: Record<string, Session[]> = {};
    for (const session of sessions) {
      const start = format(startOfWeek(parseISO(session.date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weeks[start]) weeks[start] = [];
      weeks[start].push(session);
    }
    return weeks;
  }, [sessions]);

  const raceCountdown = raceDate
    ? Math.max(0, Math.floor((parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const stravaOnlySessions = useMemo(() => {
    const keySet = new Set(sessions.map(s => `${s.date}-${s.label}`));
    return stravaActivities.filter((a) => {
      const date = a.start_date_local?.split('T')[0];
      const sportType = a.sport_type?.toLowerCase();
      const mapped = sportType === 'ride' || sportType === 'virtualride' ? 'bike' : sportType;
      const durationMin = Math.round(a.moving_time / 60);
      const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${durationMin}min ${a.name?.toLowerCase().includes('hill') ? 'hilly' : ''}`.trim();
      return !keySet.has(`${date}-${label}`);
    });
  }, [sessions, stravaActivities]);

  const scrollToDate = (date: Date) => {
    const el = document.querySelector(`[data-date="${format(date, 'yyyy-MM-dd')}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <div className="py-32 text-center text-gray-400">Loading your schedule...</div>;
  if (!sessions.length) return <div className="py-32 text-center text-gray-400">No plan found. Generate one to get started.</div>;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <div className="flex justify-center gap-4 mb-8">
        <button onClick={() => setView('calendar')} className={`px-4 py-2 rounded-full text-sm font-medium ${view === 'calendar' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>Calendar View</button>
        <button onClick={() => setView('schedule')} className={`px-4 py-2 rounded-full text-sm font-medium ${view === 'schedule' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>List View</button>
      </div>

      {view === 'calendar' && (
        isMobile ? (
          <MobileCalendarView sessions={sessions} stravaActivities={stravaActivities} />
        ) : (
          <RichCalendarView sessions={sessions} stravaActivities={stravaActivities} />
        )
      )}

      {view === 'schedule' && (
        <>
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">Your Training Plan</h1>
            {raceCountdown !== null && (
              <p className="text-gray-600 text-lg">{raceCountdown} days until race day</p>
            )}
            {coachNote && (
              <div className="mt-4 inline-block bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 text-sm shadow-sm">
                {coachNote}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-10">
            {Object.entries(groupedByWeek).map(([weekStart, weekSessions], idx) => {
              const isCollapsed = collapsedWeeks[weekStart];
              const sorted = weekSessions.sort((a, b) => a.date.localeCompare(b.date));
              const daysGrouped = sorted.reduce((acc, s) => {
                if (!acc[s.date]) acc[s.date] = [];
                acc[s.date].push(s);
                return acc;
              }, {} as Record<string, Session[]>);

              return (
                <div key={weekStart} className="flex flex-col gap-6">
                  <div className="flex items-center justify-between text-xl font-semibold text-gray-800 cursor-pointer hover:underline" onClick={() => setCollapsedWeeks(prev => ({ ...prev, [weekStart]: !prev[weekStart] }))}>
                    <span>Week of {format(parseISO(weekStart), 'MMM d')}</span>
                    <span className="text-lg">{isCollapsed ? '+' : '−'}</span>
                  </div>
                  {!isCollapsed && Object.entries(daysGrouped).map(([date, daySessions], dayIdx) => {
                    const dateObj = parseISO(date);
                    return (
                      <div key={`${weekStart}-${dayIdx}`} className="flex flex-col gap-4" data-date={date}>
                        <div className="text-md font-bold text-gray-600">{format(dateObj, 'EEEE, MMM d')}</div>
                        {daySessions.map((s) => (
                          <SessionCard
                            key={s.id}
                            session={s}
                            onStatusChange={saveSessionStatus}
                          />
                        ))}
                        {stravaOnlySessions
  .filter((activity) => isSameDay(parseISO(activity.start_date_local), dateObj))
  .map((activity, idx) => {
    const sportType = activity.sport_type?.toLowerCase();
    const mapped = sportType === 'ride' || sportType === 'virtualride' ? 'bike' : sportType;
    const durationMin = Math.round(activity.moving_time / 60);
    const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${durationMin}min ${activity.name?.toLowerCase().includes('hill') ? 'hilly' : ''}`.trim();

    return (
      <SessionCard
        key={`strava-${idx}`}
        session={{
          id: `strava-${idx}`,
          user_id: userId ?? 'strava',
          plan_id: planId ?? 'strava',
          date: activity.start_date_local.split('T')[0],
          sport: mapped,
          label,
          status: 'done',
          isStravaOnly: true,
          duration: durationMin,
          structured_workout: null,
        }}
      />
    );
  })}

                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
