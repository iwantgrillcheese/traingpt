'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';

const supabase = createClientComponentClient();

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
    return <div className="py-32 text-center text-gray-400">Loading your plan...</div>;
  }

  if (!plan.length) {
    return <div className="py-32 text-center text-gray-400">No plan found. Generate one to get started.</div>;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Top Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Training Plan</h1>
        {raceCountdown !== null && (
          <p className="text-gray-500 text-sm">{raceCountdown} days until race day</p>
        )}
        {coachNote && (
          <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm shadow-sm">
            {coachNote}
          </div>
        )}
      </div>

      {/* Plan Weeks */}
      <div className="flex flex-col gap-10">
        {plan.map((week, weekIndex) => (
          <div key={weekIndex} className="space-y-5">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">{week.label || `Week ${weekIndex + 1}`}</h2>
              {week.focus && (
                <span className="text-xs text-gray-400 italic">{week.focus}</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {Object.keys(week.days).sort().map((dateStr) => {
                const sessions = week.days[dateStr];
                const dayLabel = format(parseISO(dateStr), 'EEE, MMM d');

                return (
                  <div
                    key={dateStr}
                    className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition hover:shadow-md"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-gray-700">{dayLabel}</h3>
                    </div>

                    <div className="flex flex-col gap-2">
                      {sessions.length > 0 ? (
                        sessions.map((s: string, idx: number) => {
                          const statusKey = `${dateStr}-${s.toLowerCase()}`;
                          const status = completed[statusKey] || 'none';
                          const matched = matchStrava(dateStr, s);

                          return (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span>{getStatusIcon(status)}</span>
                              <div>
                                <p className="text-gray-800">{s}</p>
                                {matched && (
                                  <div className="text-xs text-orange-600 mt-1">
                                    Synced: {matched.distance}km • {matched.timeMin}min
                                  </div>
                                )}
                              </div>
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
          </div>
        ))}
      </div>
    </main>
  );
}
