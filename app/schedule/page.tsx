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
            fetchedPlan = plans.plan;
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
      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNote: feedback }),
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0 mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold">Your Training Plan</h1>
        <div className="text-sm text-gray-500 flex flex-wrap gap-2 sm:gap-4">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400" /> Easy</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400" /> Moderate</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" /> Hard</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 mb-10 shadow-sm">
        <p className="text-[15px] text-gray-700 mb-2 font-medium">Need tweaks? Submit feedback and reroll your plan</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-700"
            placeholder="This looks good, but can we reduce intensity in week 1?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button
            onClick={handleReroll}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded-full font-semibold text-sm text-white transition ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
            }`}
          >
            {isSubmitting ? 'Regenerating...' : 'Submit & Reroll'}
          </button>
        </div>
      </div>

      <div className="space-y-12">
        {plan.map((week, i) => {
          const sortedDates = Object.keys(week.days).sort();

          return (
            <section key={i}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-3 gap-1 sm:gap-0">
                <div>
                  <h2 className="text-lg font-semibold">{week.label}</h2>
                  {week.focus && <p className="text-sm text-gray-500 italic mt-0.5">{week.focus}</p>}
                </div>
                <span className="text-sm text-gray-400">{format(parseISO(sortedDates[0]), 'MMM d')} – {format(parseISO(sortedDates[sortedDates.length - 1]), 'MMM d')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {sortedDates.map((dateStr) => {
                  const sessions = week.days[dateStr];
                  const dateObj = parseISO(dateStr);
                  const dayLabel = format(dateObj, 'EEE, MMM d');
                  const topBar = sessions.length > 0 ? getTopBar(sessions[0]) : '';

                  return (
                    <div
                      key={dateStr}
                      className={`relative border border-gray-200 rounded-xl shadow-sm px-3 py-2 sm:px-4 sm:py-4 flex flex-col min-h-[100px] sm:min-h-[160px] bg-white 
                        before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full ${topBar}`}
                    >
                      <h3 className="text-xs font-medium text-gray-800 mb-2">{dayLabel}</h3>
                      <div className="space-y-1.5 text-sm sm:text-base">
                        {sessions.length > 0 ? sessions.map((s: string, sIdx: number) => {
                          const statusKey = `${dateStr}-${s.toLowerCase()}`;
                          const status = checked[statusKey] || 'none';
                          return (
                            <div
                              key={statusKey}
                              className={`flex items-start gap-2 group ${status === 'done' ? 'opacity-50' : status === 'skipped' ? 'opacity-50 grayscale' : ''}`}
                            >
                              <button
                                className="text-xs text-gray-400 hover:text-black transition"
                                onClick={() => toggleCheck(statusKey, dateStr, s)}
                                title="Click to cycle status"
                              >
                                {getStatusIcon(status)}
                              </button>
                              <span dangerouslySetInnerHTML={{ __html: s }} />
                            </div>
                          );
                        }) : (
                          <p className="text-sm text-gray-400 italic">Rest day</p>
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
