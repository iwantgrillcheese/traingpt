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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [quote, setQuote] = useState('');
  const quotes = [
    "Don't count the days, make the days count.",
    "Discipline is doing it when you don’t feel like it.",
    "Train hard, race easy.",
    "Little by little, a little becomes a lot.",
    "The only bad workout is the one you didn’t do."
  ];

  useEffect(() => {
    const fetchPlanFromDB = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error('[FETCH_PLAN_ERROR]', error);
          return;
        }

        const parsedPlan = data.plan || [];
        setCoachNote(data.coach_note || null);

        const normalized = parsedPlan.map((week: any, i: number) => {
          const days: any = {};
          for (const day of Object.keys(week.days)) {
            const val = week.days[day];
            days[day] = Array.isArray(val) ? val : [val];
          }
          return {
            label: week.label || `Week ${i + 1}`,
            focus: week.focus || '',
            days,
          };
        });

        setPlan(normalized);

        const { data: completedSessions, error: completedError } = await supabase
          .from('completed_sessions')
          .select('date, sport, status');

        if (completedError) console.error('[FETCH_COMPLETED_SESSIONS_ERROR]', completedError);

        const checks: { [key: string]: 'done' | 'skipped' | 'none' } = {};
        completedSessions?.forEach(({ date, sport, status }) => {
          const key = `${date}-${sport}`;
          checks[key] = status || 'none';
        });
        setChecked(checks);
      } catch (err) {
        console.error('Failed to fetch plan from DB:', err);
      }
    };

    fetchPlanFromDB();
  }, []);

  const toggleCheck = async (key: string, sessionDate: string, sessionName: string) => {
    const sport = sessionName.toLowerCase();
    const current = checked[`${sessionDate}-${sport}`] || 'none';
    const next = current === 'none' ? 'done' : current === 'done' ? 'skipped' : 'none';

    setChecked((prev) => ({ ...prev, [`${sessionDate}-${sport}`]: next }));

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error('[TOGGLE_CHECK_SESSION_ERROR]', sessionError);
      return;
    }

    const user = session.user;

    const { error } = await supabase
      .from('completed_sessions')
      .upsert([
        {
          user_id: user.id,
          date: sessionDate,
          sport,
          status: next === 'none' ? null : next,
        },
      ]);

    if (error) console.error('Failed to save checkbox state:', error);
  };

  const handleReroll = async () => {
    setIsRegenerating(true);
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw new Error('No plan data found');

      const formData = data.form_data;

      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userNote: feedback }),
      });

      if (!res.ok) throw new Error('Failed to regenerate plan');
      const { plan, coachNote } = await res.json();
      setCoachNote(coachNote);

      const normalized = plan.map((week: any, i: number) => {
        const days: any = {};
        for (const day of Object.keys(week.days)) {
          const val = week.days[day];
          days[day] = Array.isArray(val) ? val : [val];
        }
        return {
          label: week.label || `Week ${i + 1}`,
          focus: week.focus || '',
          days,
        };
      });

      setPlan(normalized);
      setFeedback('');
    } catch (err) {
      console.error('Reroll error:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!plan.length) {
    return <div className="text-center py-20 text-gray-500">No plan found. Generate one to get started.</div>;
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
      {(isRegenerating) && (
        <div className="fixed inset-0 z-50 bg-white bg-opacity-90 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-black border-b-transparent animate-spin"></div>
          </div>
          <p className="text-lg text-gray-700 font-medium italic">{quote}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0 mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold">Your Training Plan</h1>
        <div className="text-sm text-gray-500 flex flex-wrap gap-2 sm:gap-4">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400" /> Easy</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400" /> Moderate</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" /> Hard</div>
        </div>
      </div>

      {coachNote && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 mb-6 text-[15px] text-gray-700 leading-relaxed shadow-sm">
          {coachNote}
        </div>
      )}

      <div className="mb-12">
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-1">Need adjustments? Tell your coach:</label>
        <textarea
          id="feedback"
          name="feedback"
          rows={3}
          placeholder="E.g. 4 hour ride on day 1 is wild — can we dial it back?"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          disabled={isRegenerating}
          className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
        />
        <button
          onClick={handleReroll}
          disabled={isRegenerating || !feedback.trim()}
          className="mt-2 px-6 py-2 bg-black text-white font-medium rounded-full hover:bg-gray-800 disabled:opacity-50"
        >
          {isRegenerating ? 'Regenerating…' : '🔁 Regenerate Plan'}
        </button>
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
