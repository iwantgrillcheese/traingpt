'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';

const supabase = createClientComponentClient();

const getColor = (session: string) => {
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
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      {/* Top Header */}
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

      {/* Plan Sessions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {plan.flatMap((week, weekIdx) =>
          Object.entries(week.days).map(([date, sessionsRaw], dayIdx) => {
            const sessions = sessionsRaw as string[];
            const dateObj = parseISO(date);
            const topSession = sessions[0] || '';
            const colorBar = getColor(topSession);

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                className={`relative rounded-2xl border p-4 shadow-md bg-white flex flex-col justify-between min-h-[160px] before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full ${colorBar}`}
              >
                <div>
                  <h3 className="text-xs font-bold text-gray-800 mb-2">{format(dateObj, 'EEE, MMM d')}</h3>

                  {(sessions as string[]).length > 0 ? (
                    (sessions as string[]).map((s: string, sIdx: number) => {
                      const statusKey = `${date}-${s.toLowerCase()}`;
                      const status = completed[statusKey] || 'none';
                      const matched = matchStrava(date, s);

                      return (
                        <div key={sIdx} className="flex flex-col gap-1 mb-2">
                          <div className="flex items-start gap-2 text-sm text-gray-800">
                            <span>{getStatusIcon(status)}</span>
                            <span>{s}</span>
                          </div>
                          {matched && (
                            <div className="ml-5 bg-orange-50 p-2 rounded-lg text-xs text-orange-600 shadow-sm">
                              {matched.distance}km • {matched.timeMin}min
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-400 italic">Mobility / Recovery</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
