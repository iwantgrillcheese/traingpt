'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, parseISO, isSameDay } from 'date-fns';
import FantasticalCalendar from './FantasticalCalendar';

const supabase = createClientComponentClient();

export default function SchedulePage() {
  const [plan, setPlan] = useState<{
    label: string;
    startDate: string;
    raceDate: string;
    days: Record<string, string[]>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'schedule'>('calendar');
  const [userId, setUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

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

        if (plans) {
          setPlan(plans.plan || null);
          setPlanId(plans.id || null);
        }
      } catch (e) {
        console.error('[DATA_FETCH_ERROR]', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  function convertPlanDaysToSessions(planDays: Record<string, string[]>) {
    const sessions: {
      id: string;
      date: string;
      title: string;
      type: 'swim' | 'bike' | 'run' | 'other';
      color: string;
    }[] = [];

    Object.entries(planDays).forEach(([date, titles]) => {
      titles.forEach((title, idx) => {
        const lower = title.toLowerCase();
        const type = lower.includes('swim')
          ? 'swim'
          : lower.includes('bike') || lower.includes('ride')
          ? 'bike'
          : lower.includes('run')
          ? 'run'
          : 'other';

        const colorMap = {
          swim: 'bg-blue-500',
          bike: 'bg-green-500',
          run: 'bg-orange-500',
          other: 'bg-gray-400',
        };

        sessions.push({
          id: `${date}-${idx}`,
          date,
          title,
          type,
          color: colorMap[type],
        });
      });
    });

    return sessions;
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading your schedule...</div>;
  if (!plan) return <div className="py-20 text-center text-gray-400">No plan found. Generate one to get started.</div>;

  const sessions = convertPlanDaysToSessions(plan.days);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setView('calendar')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            view === 'calendar' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Calendar View
        </button>
        <button
          onClick={() => setView('schedule')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            view === 'schedule' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          List View
        </button>
      </div>

      {view === 'calendar' && <FantasticalCalendar sessions={sessions} />}

      {view === 'schedule' && (
        <div className="flex flex-col gap-6">
          {Object.entries(plan.days).map(([date, sessionsRaw]) => {
            const sessionsList = sessionsRaw as string[];
            return (
              <div key={date} className="flex flex-col gap-4" data-date={date}>
                <div className="text-md font-bold text-gray-600">{format(parseISO(date), 'EEEE, MMM d')}</div>
                {sessionsList.map((sessionTitle, sessionIdx) => (
                  <div
                    key={sessionIdx}
                    className="p-4 border rounded-lg bg-white shadow-sm"
                  >
                    {sessionTitle}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
