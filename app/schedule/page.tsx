'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';
import SessionCard from './SessionCard';
import RichCalendarView from './RichCalendarView';
import MobileCalendarView from './MobileCalendarView';

const supabase = createClientComponentClient();

export default function SchedulePage() {
  const [plan, setPlan] = useState<{
    label: string;
    startDate: string;
    raceDate: string;
    days: Record<string, string[]>;
  } | null>(null);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'schedule'>('calendar');
  const [userId, setUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  const today = new Date();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        setUserId(session.user.id);

        const { data: plans } = await supabase
          .from('plans')
          .select('plan, race_date, coach_note, id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: completedSessions } = await supabase
          .from('completed_sessions')
          .select('date, sport, status')
          .eq('user_id', session.user.id);

        const { data: activities } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', session.user.id);

        const checks: { [key: string]: string } = {};
        completedSessions?.forEach(({ date, sport, status }) => {
          checks[`${date}-${sport}`] = status;
        });

        if (plans) {
          setPlan(plans.plan || null);
          setRaceDate(plans.race_date || null);
          setCoachNote(plans.coach_note || null);
          setPlanId(plans.id || null);
        }
        setCompleted(checks);
        setStravaActivities(activities || []);
      } catch (e) {
        console.error('[DATA_FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const getNormalizedSport = (title: string): string => {
    const lowered = title.toLowerCase();
    if (lowered.includes('swim')) return 'swim';
    if (lowered.includes('bike') || lowered.includes('ride')) return 'bike';
    if (lowered.includes('run')) return 'run';
    return 'other';
  };

  const saveSessionStatus = async ({
    date,
    sportTitle,
    status,
  }: {
    date: string;
    sportTitle: string;
    status: 'done' | 'skipped' | 'missed';
  }) => {
    if (!userId) return;
    const normalizedSport = getNormalizedSport(sportTitle);
    const key = `${date}-${normalizedSport}`;

    const { error } = await supabase.from('completed_sessions').upsert(
      [
        {
          user_id: userId,
          plan_id: planId ?? null,
          date,
          sport: normalizedSport,
          status,
        },
      ],
      { onConflict: 'user_id,date,sport' }
    );

    if (error) console.error('[❌ Supabase save error]', error);

    setCompleted((prev) => ({ ...prev, [key]: status }));
  };

  const raceCountdown =
    raceDate !== null
      ? Math.max(
          0,
          Math.floor(
            (parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;

  // Flatten planned sessions set for Strava comparison
  const flattenPlannedSessions = new Set(
    Object.entries(plan?.days || {}).flatMap(([date, sessions]) =>
      sessions.map((title) => `${date}-${title}`)
    )
  );

  // Filter Strava activities not in planned sessions
  const stravaOnlySessions = stravaActivities.filter((activity) => {
    const date = activity.start_date_local?.split('T')[0];
    const sportType = activity.sport_type?.toLowerCase();
    const mapped = sportType === 'ride' || sportType === 'virtualride' ? 'bike' : sportType;
    const durationMin = Math.round(activity.moving_time / 60);
    const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${durationMin}min ${
      activity.name?.toLowerCase().includes('hill') ? 'hilly' : ''
    }`.trim();
    return !flattenPlannedSessions.has(`${date}-${label}`);
  });

  // Compute session status by date
  const sessionsByDate: Record<string, 'done' | 'skipped' | 'planned'> = {};
  Object.entries(plan?.days || {}).forEach(([date, sessions]) => {
    if (!Array.isArray(sessions)) return;
    if (
      sessions.some(
        (title) => completed[`${date}-${getNormalizedSport(title)}`] === 'done'
      )
    ) {
      sessionsByDate[date] = 'done';
    } else if (
      sessions.some(
        (title) => completed[`${date}-${getNormalizedSport(title)}`] === 'skipped'
      )
    ) {
      sessionsByDate[date] = 'skipped';
    } else {
      sessionsByDate[date] = 'planned';
    }
  });

  const scrollToDate = (date: Date) => {
    const el = document.querySelector(`[data-date="${format(date, 'yyyy-MM-dd')}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading)
    return <div className="py-32 text-center text-gray-400">Loading your schedule...</div>;
  if (!plan)
    return <div className="py-32 text-center text-gray-400">No plan found. Generate one to get started.</div>;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setView('calendar')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            view === 'calendar' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Calendar View
        </button>
        <button
          onClick={() => setView('schedule')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            view === 'schedule' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          List View
        </button>
      </div>

      {view === 'calendar' &&
        (isMobile ? (
          <MobileCalendarView
            plan={plan}
            completed={completed}
            stravaActivities={stravaActivities}
          />
        ) : (
          <RichCalendarView
            plan={plan}
            completed={completed}
            stravaActivities={stravaActivities}
          />
        ))}

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

          <div className="flex flex-col gap-6">
            {Object.entries(plan.days).map(([date, sessionsRaw]) => {
              const sessions = sessionsRaw as string[];
              const dateObj = parseISO(date);
              return (
                <div key={date} className="flex flex-col gap-4" data-date={date}>
                  <div className="text-md font-bold text-gray-600">
                    {format(dateObj, 'EEEE, MMM d')}
                  </div>
                  {sessions.map((sessionTitle, sessionIdx) => (
                    <SessionCard
                      key={sessionIdx}
                      title={sessionTitle}
                      date={date}
                      initialStatus={
                        completed[`${date}-${getNormalizedSport(sessionTitle)}`] as
                          | 'done'
                          | 'skipped'
                          | 'missed'
                      }
                      onStatusChange={(newStatus) =>
                        saveSessionStatus({ date, sportTitle: sessionTitle, status: newStatus })
                      }
                    />
                  ))}
                  {stravaOnlySessions
                    .filter((activity) => isSameDay(parseISO(activity.start_date_local), dateObj))
                    .map((activity, idx) => {
                      const sportType = activity.sport_type?.toLowerCase();
                      const mapped =
                        sportType === 'ride' || sportType === 'virtualride' ? 'bike' : sportType;
                      const durationMin = Math.round(activity.moving_time / 60);
                      const label = `${mapped.charAt(0).toUpperCase() + mapped.slice(1)}: ${durationMin}min ${
                        activity.name?.toLowerCase().includes('hill') ? 'hilly' : ''
                      }`.trim();
                      return (
                        <SessionCard
                          key={`strava-${idx}`}
                          title={label}
                          date={activity.start_date_local.split('T')[0]}
                          isStravaOnly={true}
                        />
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
