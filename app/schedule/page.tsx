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

const getSessionColor = (session: string) => {
  const lower = session.toLowerCase();
  if (lower.includes('interval') || lower.includes('brick') || lower.includes('race pace')) return 'bg-red-400';
  if (lower.includes('threshold') || lower.includes('tempo') || lower.includes('z3')) return 'bg-yellow-400';
  return 'bg-green-400';
};

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
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

  // Flatten weeks into days
  const allDays = plan.flatMap(week => 
    Object.entries(week.days).map(([date, sessions]) => ({ date, sessions }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
      {/* Top Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Your Training Plan</h1>
        {raceCountdown !== null && (
          <p className="text-gray-600 text-lg">{raceCountdown} days until race day</p>
        )}
        {coachNote && (
          <div className="mt-4 inline-block bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 text-sm shadow-sm">
            {coachNote}
          </div>
        )}
      </div>

      {/* Daily List */}
      <div className="flex flex-col gap-6">
        {allDays.map(({ date, sessions }, idx) => (
          <div
            key={idx}
            className="flex items-start gap-4 border-b pb-6 last:border-none"
          >
            <div className="flex flex-col items-center pt-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mb-2" />
              {idx !== allDays.length - 1 && (
                <div className="w-px flex-1 bg-gray-200" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{format(parseISO(date), 'EEE, MMM d')}</h3>
              </div>

              {sessions.length > 0 ? (
                sessions.map((s: string, sIdx: number) => {
                  const statusKey = `${date}-${s.toLowerCase()}`;
                  const status = completed[statusKey] || 'none';
                  const matched = matchStrava(date, s);

                  return (
                    <div
                      key={sIdx}
                      className="flex items-start gap-3 text-sm py-1"
                    >
                      <div className={`h-2 w-2 rounded-full mt-2 ${getSessionColor(s)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span>{getStatusIcon(status)}</span>
                          <span>{s}</span>
                        </div>
                        {matched && (
                          <div className="ml-6 mt-1 text-xs text-orange-600 bg-orange-50 p-2 rounded-lg shadow-sm">
                            {matched.distance}km • {matched.timeMin}min
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>⚪</span> Mobility / Recovery
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
