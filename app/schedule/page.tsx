'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';

const supabase = createClientComponentClient();

const getTopBarColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes('interval') || s.includes('brick') || s.includes('race pace')) return 'before:bg-red-400';
  if (s.includes('threshold') || s.includes('tempo')) return 'before:bg-yellow-400';
  return 'before:bg-green-400';
};

const getStatusIcon = (status: string) => {
  if (status === 'done') return '✅';
  if (status === 'skipped') return '⛔';
  return '⚪';
};

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: planData } = await supabase
          .from('plans')
          .select('plan, race_date, coach_note')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: completedSessions } = await supabase
          .from('completed_sessions')
          .select('date, sport, status');

        const { data: activities } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', session.user.id);

        const checks: { [key: string]: string } = {};
        completedSessions?.forEach(({ date, sport, status }) => {
          checks[`${date}-${sport}`] = status;
        });

        if (planData) {
          setPlan(planData.plan || []);
          setRaceDate(planData.race_date || null);
          setCoachNote(planData.coach_note || null);
        }

        setCompleted(checks);
        setStravaActivities(activities || []);
      } catch (e) {
        console.error('[DATA_FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const matchStrava = (date: string, session: string) => {
    const sessionLower = session.toLowerCase();
    const sameDayActivities = stravaActivities.filter((a) => isSameDay(new Date(a.start_date_local), parseISO(date)));

    for (const act of sameDayActivities) {
      const actType = (act.sport_type || '').toLowerCase();
      if (
        (sessionLower.includes('bike') && actType.includes('ride')) ||
        (sessionLower.includes('run') && actType.includes('run')) ||
        (sessionLower.includes('swim') && actType.includes('swim'))
      ) {
        return {
          name: act.name,
          distance_km: (act.distance / 1000).toFixed(1),
          moving_time_min: Math.round(act.moving_time / 60),
        };
      }
    }
    return null;
  };

  const today = new Date();
  const raceCountdown = raceDate ? Math.max(0, Math.floor((parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : null;

  if (loading) return <div className="text-center py-32 text-gray-400">Loading your schedule...</div>;
  if (!plan.length) return <div className="text-center py-32 text-gray-400">No plan found. Please create one.</div>;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
      {/* Top Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Your Training Plan</h1>
        {raceCountdown !== null && <p className="text-gray-600 text-lg">{raceCountdown} days until race day</p>}
        {coachNote && (
          <div className="mt-5 inline-block bg-gray-100 border border-gray-200 text-gray-700 rounded-xl px-6 py-4 text-sm shadow">
            {coachNote}
          </div>
        )}
      </div>

      {/* Plan Weeks */}
      <div className="space-y-14">
        {plan.map((week, idx) => {
          const sortedDates = Object.keys(week.days).sort();
          return (
            <section key={idx}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{week.label || `Week ${idx + 1}`}</h2>
                  {week.focus && <p className="text-sm text-gray-500 italic">{week.focus}</p>}
                </div>
                <p className="text-sm text-gray-400">{format(parseISO(sortedDates[0]), 'MMM d')} – {format(parseISO(sortedDates.at(-1)!), 'MMM d')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {sortedDates.map((dateStr) => {
                  const sessions = week.days[dateStr];
                  const dayLabel = format(parseISO(dateStr), 'EEE, MMM d');

                  return (
                    <div
                      key={dateStr}
                      className={`relative border rounded-xl shadow-md p-4 bg-white flex flex-col min-h-[180px] before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full ${getTopBarColor(sessions[0] || '')}`}
                    >
                      <h3 className="text-xs font-bold text-gray-700 mb-4">{dayLabel}</h3>

                      <div className="flex flex-col gap-2">
                        {sessions.length > 0 ? sessions.map((s: string, i: number) => {
                          const statusKey = `${dateStr}-${s.toLowerCase()}`;
                          const status = completed[statusKey] || 'none';
                          const matched = matchStrava(dateStr, s);

                          return (
                            <div key={i} className="flex flex-col gap-1">
                              <div className="flex items-start gap-2 text-sm text-gray-800">
                                <span>{getStatusIcon(status)}</span>
                                <span>{s}</span>
                              </div>
                              {matched && (
                                <div className="ml-6 mt-1 bg-orange-50 rounded-md p-2 text-xs text-orange-700 shadow-sm">
                                  🏁 {matched.name}<br />
                                  {matched.distance_km} km • {matched.moving_time_min} min
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <p className="text-sm text-gray-400 italic">Mobility / Recovery</p>
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
