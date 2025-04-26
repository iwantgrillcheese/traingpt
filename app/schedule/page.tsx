'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createClientComponentClient();

const getTopBar = (session: string) => {
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
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ [key: string]: 'done' | 'skipped' | 'none' }>({});
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchPlanAndChecks = async () => {
      let fetchedPlan = null;
      let fetchedCoachNote = null;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: plans, error } = await supabase
            .from('plans')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!error && plans?.plan) {
            fetchedPlan = plans.plan.plan || plans.plan; // patched here
            fetchedCoachNote = plans.coach_note || null;
          }
        }
      } catch (e) {
        console.error('[SUPABASE_FETCH_ERROR]', e);
      }

      if (!fetchedPlan) {
        const stored = localStorage.getItem('trainGPTPlan');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            fetchedPlan = parsed.plan || parsed;
            fetchedCoachNote = parsed.coachNote || null;
          } catch (err) {
            console.error('Failed to parse stored plan:', err);
          }
        }
      }

      if (Array.isArray(fetchedPlan)) {
        const normalized = fetchedPlan.map((week, i) => {
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
            days,
          };
        });
        setPlan(normalized);
        setCoachNote(fetchedCoachNote);

        try {
          const { data: completedSessions, error } = await supabase
            .from('completed_sessions')
            .select('date, sport, status');

          if (error) console.error('[FETCH_COMPLETED_SESSIONS_ERROR]', error);

          const checks: { [key: string]: 'done' | 'skipped' | 'none' } = {};
          completedSessions?.forEach(({ date, sport, status }) => {
            const key = `${date}-${sport}`;
            checks[key] = status || 'none';
          });
          setChecked(checks);
        } catch (err) {
          console.error('[SUPABASE_COMPLETED_SESSIONS_FETCH_FAILED]', err);
        }
      }
    };

    fetchPlanAndChecks();
  }, []);

  const toggleCheck = async (key: string, sessionDate: string, sessionName: string) => {
    const sport = sessionName.toLowerCase();
    const current = checked[`${sessionDate}-${sport}`] || 'none';
    const next = current === 'none' ? 'done' : current === 'done' ? 'skipped' : 'none';

    setChecked((prev) => ({ ...prev, [`${sessionDate}-${sport}`]: next }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      await supabase.from('completed_sessions').upsert([
        {
          user_id: session.user.id,
          date: sessionDate,
          sport,
          status: next === 'none' ? null : next,
        },
      ]);
    } catch (err) {
      console.error('[TOGGLE_CHECK_ERROR]', err);
    }
  };

  const handleReroll = async () => {
    if (!feedback) return;
    setIsSubmitting(true);
    try {
      const stored = localStorage.getItem('trainGPTPlan');
      const parsed = stored ? JSON.parse(stored) : null;

      const payload = {
        raceType: parsed?.raceType,
        raceDate: parsed?.raceDate,
        experience: parsed?.experience,
        maxHours: parsed?.maxHours
        restDay: parsed?.restDay,
        userNote: feedback,
      };

      console.log('[REROLL_PAYLOAD]', payload);

      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) location.reload();
      else throw new Error('Failed to regenerate plan');
    } catch (err) {
      console.error('[PLAN_REROLL_ERROR]', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!plan.length) {
    return <div className="text-center py-20 text-gray-500">No plan found. Generate one to get started.</div>;
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
      {/* rest of the file unchanged... */}
    </main>
  );
}
