'use client';

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { SessionCard } from './SessionCard';

const supabase = createClientComponentClient();

export default function SchedulePage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ [key: string]: string }>({});
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
          setPlan(plans.plan || []);
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

  const saveSessionStatus = async ({ date, sport, status }: { date: string; sport: string; status: string }) => {
    if (!userId || !planId) return;

    await supabase
      .from('completed_sessions')
      .upsert(
        [{ user_id: userId, plan_id: planId, date, sport, status }],
        { onConflict: 'user_id,date,sport' }
      );

    setCompleted((prev) => ({ ...prev, [`${date}-${sport}`]: status }));
  };

  const today = new Date();
  const raceCountdown = raceDate ? Math.max(0, Math.floor((parseISO(raceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : null;

  const isPast = (date: Date) => isBefore(date, today) && !isToday(date);

  if (loading) {
    return <div className="py-32 text-center text-gray-400">Loading your schedule...</div>;
  }

  if (!plan.length) {
    return <div className="py-32 text-center text-gray-400">No plan found. Generate one to get started.</div>;
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-16" ref={containerRef}>
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

      <div className="flex flex-col gap-10">
        {plan.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-6">
            <div className="text-xl font-semibold text-gray-800">{week.label}</div>

            {Object.entries(week.days).map(([date, sessionsRaw], dayIdx) => {
              const sessions = sessionsRaw as string[];
              const dateObj = parseISO(date);
              const collapsed = isPast(dateObj);

              return (
                <details key={`${weekIdx}-${dayIdx}`} open={!collapsed} className="group border rounded-xl">
                  <summary className="text-md font-bold text-gray-600 px-4 py-3 cursor-pointer">
                    {format(dateObj, 'EEEE, MMM d')}
                  </summary>

                  <div className="flex flex-col gap-4 px-4 pb-4">
                    {sessions.map((sessionTitle, sessionIdx) => (
                      <SessionCard
                        key={sessionIdx}
                        title={sessionTitle}
                        date={date}
                        initialStatus={completed[`${date}-${sessionTitle}`] as 'done' | 'skipped' | 'missed' | undefined}
                        onStatusChange={(newStatus) =>
                          saveSessionStatus({ date, sport: sessionTitle, status: newStatus })
                        }
                      />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
