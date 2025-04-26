'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO } from 'date-fns';

const supabase = createClientComponentClient();

const getTopBar = (session: string) => {
  if (typeof session !== 'string') return '';
  const lower = session.toLowerCase();
  if (lower.includes('interval') || lower.includes('race pace') || lower.includes('brick')) return 'before:bg-red-400';
  if (lower.includes('tempo') || lower.includes('z3') || lower.includes('threshold')) return 'before:bg-yellow-400';
  return 'before:bg-green-400';
};

const getStatusIcon = (status: 'done' | 'skipped' | 'none') => {
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
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: plans } = await supabase
          .from('plans')
          .select('plan')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: completed_sessions } = await supabase
          .from('completed_sessions')
          .select('date, sport, status');

        let stravaData: any[] = [];
        try {
          const { data: strava_activities } = await supabase
            .from('strava_activities')
            .select('*')
            .eq('user_id', session.user.id);

          if (strava_activities) stravaData = strava_activities;
        } catch (stravaErr) {
          console.warn('No strava_activities table found yet.');
        }

        const checks: { [key: string]: any } = {};
        completed_sessions?.forEach(({ date, sport, status }) => {
          checks[`${date}-${sport}`] = status;
        });

        setCompleted(checks);
        setStravaActivities(stravaData);

        if (plans?.plan) {
          const normalized = plans.plan.map((week: any, i: number) => {
            const days: any = {};
            const source = typeof week.days === 'object' ? week.days : week;
            for (const day of Object.keys(source)) {
              const val = source[day];
              days[day] = Array.isArray(val) ? val : [val];
            }
            return {
              label: week.label || `Week ${i + 1}`,
              focus: week.focus || '',
              days,
            };
          });
          setPlan(normalized);
        }
      } catch (err) {
        console.error('[FETCH_DATA_ERROR]', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading your plan...</div>;
  }

  if (!plan.length) {
    return <div className="text-center py-20 text-gray-500">No training plan found.</div>;
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold mb-10">Your Training Plan</h1>

      <div className="space-y-12">
        {plan.map((week, idx) => {
          const dates = Object.keys(week.days).sort();
          return (
            <section key={idx}>
              <div className="flex justify-between items-end mb-5">
                <div>
                  <h2 className="text-lg font-bold">{week.label}</h2>
                  {week.focus && <p className="text-sm text-gray-500 italic">{week.focus}</p>}
                </div>
                <p className="text-sm text-gray-400">{format(parseISO(dates[0]), 'MMM d')} - {format(parseISO(dates[dates.length - 1]), 'MMM d')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {dates.map((dateStr) => {
                  const sessions = week.days[dateStr] || [];
                  const dateObj = parseISO(dateStr);

                  return (
                    <div
                      key={dateStr}
                      className={`relative border rounded-xl shadow-sm px-4 py-4 flex flex-col min-h-[140px] bg-white before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full ${getTopBar(sessions[0])}`}
                    >
                      <h3 className="text-xs font-semibold text-gray-800 mb-3">{format(dateObj, 'EEE, MMM d')}</h3>

                      <div className="space-y-2 text-sm">
                        {sessions.length ? (
                          sessions.map((s: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <span>{getStatusIcon(completed[`${dateStr}-${s.toLowerCase?.()}`] || 'none')}</span>
                              <span>{typeof s === 'string' ? s : 'Invalid session'}</span>
                            </div>
                          ))
                        ) : (
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
