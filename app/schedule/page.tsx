'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO } from 'date-fns';
import FantasticalCalendar from './FantasticalCalendar';

const supabase = createClientComponentClient();

export default function SchedulePage() {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'schedule'>('calendar');
  const [completed, setCompleted] = useState<Record<string, string>>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: planRow } = await supabase
          .from('plans')
          .select('plan, race_date, coach_note, id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (planRow) {
          setPlan(planRow.plan || null);
        }

        const { data: completedRows = [] } = await supabase
          .from('completed_sessions')
          .select('date, sport, status');

        const completedMap: Record<string, string> = {};
        if (completedRows) {
  completedRows.forEach(({ date, sport, status }) => {
    const key = `${date}-${sport}`;
    completedMap[key] = status;
  });
}
        setCompleted(completedMap);

        const { data: stravaData } = await supabase
  .from('strava_activities')
  .select('*')
  .order('start_date_local', { ascending: false });

setStravaActivities(stravaData ?? []);

      } catch (e) {
        console.error('[DATA_FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading)
    return (
      <div className="py-20 text-center text-primary-light">Loading your schedule...</div>
    );
  if (!plan)
    return (
      <div className="py-20 text-center text-primary-light">
        No plan found. Generate one to get started.
      </div>
    );

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setView('calendar')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            view === 'calendar'
              ? 'bg-primary text-white shadow-medium'
              : 'bg-background-light text-primary hover:bg-gray-100'
          }`}
        >
          Calendar View
        </button>
        <button
          onClick={() => setView('schedule')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            view === 'schedule'
              ? 'bg-primary text-white shadow-medium'
              : 'bg-background-light text-primary hover:bg-gray-100'
          }`}
        >
          List View
        </button>
      </div>

      {view === 'calendar' && (
        <FantasticalCalendar
          plan={plan}
          completed={completed}
          stravaActivities={stravaActivities}
        />
      )}

      {view === 'schedule' && (
        <>
          {plan.raceDate && (
            <p className="text-center text-primary-light mb-4">
              Race Date: {format(parseISO(plan.raceDate), 'MMMM d, yyyy')}
            </p>
          )}
          <div className="flex flex-col gap-6">
            {Object.entries(plan.days).map(([date, sessionsRaw]) => {
              const sessionsList = sessionsRaw as string[];
              return (
                <div key={date} className="flex flex-col gap-4" data-date={date}>
                  <div className="text-md font-bold text-primary">{format(parseISO(date), 'EEEE, MMM d')}</div>
                  {sessionsList.map((sessionTitle, sessionIdx) => (
                    <div
                      key={sessionIdx}
                      className="p-4 border rounded-xl bg-white shadow-subtle"
                    >
                      {sessionTitle}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
