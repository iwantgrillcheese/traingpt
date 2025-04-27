'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';

const supabase = createClientComponentClient();

const getColor = (session: string) => {
  const lower = session.toLowerCase();
  if (lower.includes('interval') || lower.includes('brick') || lower.includes('race pace')) return 'border-red-400';
  if (lower.includes('tempo') || lower.includes('threshold')) return 'border-yellow-400';
  return 'border-green-400';
};

const getStatusIcon = (status: string) => {
  if (status === 'done') return '✅';
  if (status === 'skipped') return '⛔';
  return '⚪';
};

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
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

        if (plans) {
          setPlan(plans.plan || []);
          setRaceDate(plans.race_date || null);
          setCoachNote(plans.coach_note || null);
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

  const today = new Date();
  const raceCountdown = raceDate ? Math.max(0, Math.floor((parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : null;

  const matchStrava = (date: string, session: string) => {
    const dayActivities = stravaActivities.filter((a) => isSameDay(new Date(a.start_date_local), parseISO(date)));
    const lower = session.toLowerCase();
    if (!dayActivities.length) return null;

    for (const activity of dayActivities) {
      const actType = (activity.sport_type || '').toLowerCase();
      if (
        (lower.includes('run') && actType.includes('run')) ||
        (lower.includes('bike') && actType.includes('ride')) ||
        (lower.includes('swim') && actType.includes('swim'))
      ) {
        return {
          name: activity.name,
          distance: (activity.distance / 1000).toFixed(1),
          timeMin: Math.round(activity.moving_time / 60),
        };
      }
    }
    return null;
  };

  if (loading) {
    return <div className="py-32 text-center text-gray-400">Loading your schedule...</div>;
  }

  if (!plan.length) {
    return <div className="py-32 text-center text-gray-400">No plan found. Generate one to get started.</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Your Training Plan</h1>
        {raceCountdown !== null && (
          <p className="text-gray-500 text-lg">{raceCountdown} days until race day</p>
        )}
        {coachNote && (
          <div className="mt-5 max-w-xl mx-auto border border-blue-300 bg-white rounded-xl p-4 text-sm text-blue-700 shadow-sm">
            {coachNote}
          </div>
        )}
      </div>

      {/* Plan */}
      <div className="space-y-14">
        {plan.map((week, i) => {
          const sortedDays = Object.keys(week.days).sort();
          return (
            <section key={i}>
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-xl font-semibold">{week.label || `Week ${i + 1}`}</h2>
                  {week.focus && (
                    <p className="text-sm text-gray-500 italic">{week.focus}</p>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {format(parseISO(sortedDays[0]), 'MMM d')} – {format(parseISO(sortedDays[sortedDays.length - 1]), 'MMM d')}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {sortedDays.map((dateStr) => {
                  const sessions = week.days[dateStr];
                  const dayLabel = format(parseISO(dateStr), 'EEE, MMM d');

                  return (
                    <div
                      key={dateStr}
                      className="relative flex flex-col justify-between rounded-2xl border p-4 shadow-sm bg-white transition hover:shadow-md"
                    >
                      <div>
                        <h3 className="text-xs font-semibold text-gray-600 mb-2">{dayLabel}</h3>
                        <div className="space-y-1.5">
                          {sessions.length > 0 ? (
                            sessions.map((s: string, idx: number) => {
                              const statusKey = `${dateStr}-${s.toLowerCase()}`;
                              const status = completed[statusKey] || 'none';
                              const matched = matchStrava(dateStr, s);

                              return (
                                <div key={idx} className="flex flex-col gap-1">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs">{getStatusIcon(status)}</span>
                                    <span className="text-sm font-medium">{s}</span>
                                  </div>
                                  {matched && (
                                    <div className="ml-5 text-xs bg-orange-50 p-1 rounded-md text-orange-700">
                                      {matched.distance}km • {matched.timeMin}min
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-gray-400 italic text-sm">Mobility / Recovery</p>
                          )}
                        </div>
                      </div>

                      {/* Top border indicator */}
                      {sessions.length > 0 && (
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 rounded-full ${getColor(sessions[0])}`} />
                      )}
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
