'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay, differenceInMinutes } from 'date-fns';

const supabase = createClientComponentClient();

const getTopBarColor = (session: string) => {
  const lower = session.toLowerCase();
  if (lower.includes('interval') || lower.includes('race pace') || lower.includes('brick')) return 'before:bg-red-400';
  if (lower.includes('tempo') || lower.includes('z3') || lower.includes('threshold')) return 'before:bg-yellow-400';
  return 'before:bg-green-400';
};

const getSessionStatusIcon = (status: 'done' | 'skipped' | 'none') => {
  if (status === 'done') return '✅';
  if (status === 'skipped') return '⛔';
  return '⚪';
};

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [completed, setCompleted] = useState<{ [key: string]: any }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: plans } = await supabase
          .from('plans')
          .select('plan, coach_note')
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

        const checks: { [key: string]: any } = {};
        completedSessions?.forEach(({ date, sport, status }) => {
          checks[`${date}-${sport}`] = status;
        });

        setCompleted(checks);
        setStravaActivities(activities || []);

        if (plans?.plan) {
          const normalized = plans.plan.map((week: any, i: number) => {
            const hasDays = typeof week?.days === 'object';
            const daySource = hasDays ? week.days : week;
            const days: any = {};
            for (const day of Object.keys(daySource)) {
              const val = daySource[day];
              days[day] = Array.isArray(val) ? val : [val];
            }
            return {
              label: week.label || `Week ${i + 1}`,
              focus: week.focus || '',
              coach_note: week.coach_note || plans.coach_note || '',
              days,
            };
          });
          setPlan(normalized);
        }
      } catch (e) {
        console.error('[FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

const matchStrava = (date: string, session: string) => {
  const dayActivities = stravaActivities.filter((a) => isSameDay(new Date(a.start_date_local), parseISO(date)));
  const sport = session.toLowerCase();
  if (!dayActivities.length) return null;

  for (const activity of dayActivities) {
    const actType = (activity.sport_type || '').toLowerCase();
    const durationMin = activity.moving_time ? activity.moving_time / 60 : 0;

    // Fuzzy match: match run to run, ride to bike, swim to swim, and +/- 20min duration window
    if (
      (sport.includes('run') && actType.includes('run')) ||
      (sport.includes('bike') && actType.includes('ride')) ||
      (sport.includes('swim') && actType.includes('swim'))
    ) {
      if (!activity.manual && Math.abs(differenceInMinutes(new Date(activity.start_date_local), parseISO(date))) < 1440) {
        return {
          name: activity.name,
          distance_km: (activity.distance / 1000).toFixed(1),
          moving_time: Math.round(durationMin),
        };
      }
    }
  }
  return null;
};

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <div className="animate-pulse">Loading your personalized training plan...</div>
      </div>
    );
  }

  if (!plan.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        No training plan found. Please create one to get started!
      </div>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold mb-10 text-center sm:text-left">Your Training Schedule</h1>

      <div className="space-y-16">
        {plan.map((week, i) => {
          const sortedDates = Object.keys(week.days).sort();
          const completedSessions = sortedDates.flatMap((date) =>
            week.days[date].map((s: string) => {
              const key = `${date}-${s.toLowerCase()}`;
              return completed[key] === 'done' ? 1 : 0;
            })
          );
          const weekCompletion = completedSessions.length
            ? Math.round((completedSessions.reduce((a, b) => a + b, 0) / completedSessions.length) * 100)
            : 0;

          return (
            <section key={i}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-3">
                <div>
                  <h2 className="text-lg font-bold">{week.label}</h2>
                  {week.focus && <p className="text-sm text-gray-500">{week.focus}</p>}
                  {week.coach_note && (
                    <div className="mt-2 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg max-w-xl">
                      📋 Coach note: {week.coach_note}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{format(parseISO(sortedDates[0]), 'MMM d')} – {format(parseISO(sortedDates[sortedDates.length - 1]), 'MMM d')}</p>
                  <p className="text-xs text-green-600">{weekCompletion}% sessions completed ✅</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {sortedDates.map((dateStr) => {
                  const sessions = week.days[dateStr];
                  const dateObj = parseISO(dateStr);

                  return (
                    <div
                      key={dateStr}
                      className={`relative border rounded-xl shadow-sm px-4 py-4 bg-white hover:scale-[1.02] transition-all cursor-pointer before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full ${getTopBarColor(sessions[0])}`}
                    >
                      <h3 className="text-xs font-bold text-gray-700 mb-3">{format(dateObj, 'EEE, MMM d')}</h3>

                      <div className="space-y-2 text-sm">
                        {sessions.length > 0 ? (
                          sessions.map((s: string, idx: number) => {
  if (!s) return null; // prevent blowing up on undefined/null sessions

  const statusKey = `${dateStr}-${s.toLowerCase()}`;
  const status = completed[statusKey] || 'none';
  const matched = matchStrava(dateStr, s);

  return (
    <div key={idx} className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <span>{getStatusIcon(status)}</span>
        <span>{s}</span>
      </div>
      {matched && (
        <div className="text-xs bg-orange-50 p-2 rounded-lg shadow-sm">
          <div className="font-medium text-orange-600">🏁 Synced from Strava</div>
          <div>{matched.distance_km}km • {matched.moving_time}min</div>
        </div>
      )}
    </div>
  );
})
                        ) : (
                          <p className="text-gray-400 italic">Mobility/Recovery</p>
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
