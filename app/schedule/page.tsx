'use client';

import { useEffect, useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
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

  useEffect(() => {
    const fetchPlanAndChecks = async () => {
      const stored = localStorage.getItem('trainGPTPlan');
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored);
        const extractedPlan = parsed.plan || parsed;
        const note = parsed.coachNote || null;
        setCoachNote(note);

        if (Array.isArray(extractedPlan)) {
          const normalized = extractedPlan.map((week, i) => {
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
        }
      } catch (err) {
        console.error('Failed to parse stored plan:', err);
      }
    };

    fetchPlanAndChecks();
  }, []);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

      {coachNote && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 mb-10 text-[15px] text-gray-700 leading-relaxed shadow-sm">
          {coachNote}
        </div>
      )}

      <div className="space-y-12">
        {plan.map((week, i) => {
          const start = addDays(weekStart, i * 7);
          const end = addDays(start, 6);
          return (
            <section key={i}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-3 gap-1 sm:gap-0">
                <div>
                  <h2 className="text-lg font-semibold">{week.label}</h2>
                  {week.focus && <p className="text-sm text-gray-500 italic mt-0.5">{week.focus}</p>}
                </div>
                <span className="text-sm text-gray-400">{format(start, 'MMM d')} – {format(end, 'MMM d')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {weekDays.map((day, d) => {
                  const sessions = Array.isArray(week.days?.[day]) ? week.days[day] : [];
                  const label = weekLabels[d];
                  const topBar = sessions.length > 0 ? getTopBar(sessions[0]) : '';

                  return (
                    <div
                      key={day}
                      className={`relative border border-gray-200 rounded-xl shadow-sm px-4 py-4 flex flex-col min-h-[160px] bg-white 
                        before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-1/2 before:h-1 before:rounded-full ${topBar}`}
                    >
                      <h3 className="text-xs font-medium text-gray-800 mb-2">{label}</h3>
                      <div className="space-y-1.5 text-sm">
                        {sessions.length > 0 ? sessions.map((s: string, sIdx: number) => {
                          const sessionDate = format(addDays(weekStart, i * 7 + d), 'yyyy-MM-dd');
                          const sportKey = `${sessionDate}-${s.toLowerCase()}`;
                          const status = checked[sportKey] || 'none';
                          return (
                            <div
                              key={sportKey}
                              className={`flex items-start gap-2 group ${status === 'done' ? 'opacity-50' : status === 'skipped' ? 'opacity-50 grayscale' : ''}`}
                            >
                              <button
                                className="text-xs text-gray-400 hover:text-black transition"
                                onClick={() => toggleCheck(sportKey, sessionDate, s)}
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
