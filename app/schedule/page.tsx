'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';

const supabase = createClientComponentClient();

const getIntensityColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes('interval') || s.includes('brick') || s.includes('race pace')) return 'bg-red-400';
  if (s.includes('tempo') || s.includes('threshold') || s.includes('z3')) return 'bg-yellow-400';
  return 'bg-green-400';
};

const getStatusIcon = (status: string) => {
  if (status === 'done') return '✅';
  if (status === 'skipped') return '⛔';
  return '⭕';
};

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: plans } = await supabase
          .from('plans')
          .select('plan, race_date, coach_note')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: sessions } = await supabase
          .from('completed_sessions')
          .select('date, sport, status');

        const { data: activities } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', session.user.id);

        const checks: { [key: string]: string } = {};
        sessions?.forEach(({ date, sport, status }) => {
          checks[`${date}-${sport}`] = status;
        });

        if (plans) {
          setPlan(plans.plan || []);
          setRaceDate(plans.race_date || null);
          setCoachNote(plans.coach_note || null);
        }

        setCompleted(checks);
        setStravaActivities(activities || []);
      } catch (err) {
        console.error('[FETCH_ERROR]', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const today = new Date();
  const raceCountdown = raceDate ? Math.max(0, Math.floor((parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : null;

  const matchStrava = (date: string, session: string) => {
    const dayActs = stravaActivities.filter((a) => isSameDay(new Date(a.start_date_local), parseISO(date)));
    const s = session.toLowerCase();
    if (!dayActs.length) return null;

    for (const act of dayActs) {
      const type = (act.sport_type || '').toLowerCase();
      if (
        (s.includes('run') && type.includes('run')) ||
        (s.includes('bike') && type.includes('ride')) ||
        (s.includes('swim') && type.includes('swim'))
      ) {
        return {
          name: act.name,
          distance: (act.distance / 1000).toFixed(1),
          timeMin: Math.round(act.moving_time / 60),
        };
      }
    }
    return null;
  };

  if (loading) {
    return <div className="py-32 text-center text-gray-400">Loading your plan...</div>;
  }

  if (!plan.length) {
    return <div className="py-32 text-center text-gray-400">No plan available yet.</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">Your Training Plan</h1>
        {raceCountdown !== null && (
          <p className="text-lg text-gray-600">{raceCountdown} days until race day</p>
        )}
        {coachNote && (
          <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-xl text-sm shadow-sm max-w-2xl mx-auto">
            {coachNote}
          </div>
        )}
      </div>

      {/* Weeks */}
      <div className="space-y-16">
        {plan.map((week, wIdx) => {
          const sortedDays = Object.keys(week.days).sort();
          return (
            <section key={wIdx}>
              {/* Week header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{week.label || `Week ${wIdx + 1}`}</h2>
                  {week.focus && (
                    <p className="text-sm text-gray-500">{week.focus}</p>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {format(parseISO(sortedDays[0]), 'MMM d')} – {format(parseISO(sortedDays[sortedDays.length - 1]), 'MMM d')}
                </div>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5">
                {sortedDays.map((dateStr) => {
                  const sessions = week.days[dateStr];
                  const formattedDate = format(parseISO(dateStr), 'EEE, MMM d');

                  return (
                    <div key={dateStr} className="relative flex flex-col rounded-2xl border bg-white p-4 shadow hover:shadow-md transition-all before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full">
                      <h3 className="text-xs font-bold text-gray-700 mb-2">{formattedDate}</h3>

                      <div className="space-y-2">
                        {sessions.length > 0 ? (
                          sessions.map((session: string, idx: number) => {
                            const key = `${dateStr}-${session.toLowerCase()}`;
                            const status = completed[key] || 'none';
                            const matched = matchStrava(dateStr, session);

                            return (
                              <div key={idx} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">{getStatusIcon(status)}</span>
                                  <span className="text-sm text-gray-800">{session}</span>
                                </div>
                                {matched && (
                                  <div className="bg-orange-50 text-orange-600 p-2 rounded-lg text-xs shadow-sm">
                                    {matched.distance} km • {matched.timeMin} min
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm italic text-gray-400">Mobility / Recovery</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
