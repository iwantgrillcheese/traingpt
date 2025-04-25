'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export default function CoachingDashboard() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [plan, setPlan] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<string[]>([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchPlan = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const { data: plans, error } = await supabase
        .from('plans')
        .select('plan')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && plans?.plan) {
        setPlan(plans.plan);

        const weekToday = plans.plan.find((week: any) =>
          Object.keys(week.days).includes(today)
        );
        setTodaySessions(weekToday?.days[today] || []);
      }
    };

    fetchPlan();
  }, []);

  const askCoach = async () => {
    if (!question) return;
    setResponse('Thinking...');

    const res = await fetch('/api/coach-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNote: question }),
    });

    const data = await res.json();
    if (res.ok && data?.response) setResponse(data.response);
    else setResponse('Sorry, something went wrong. Try again.');
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Coaching Dashboard</h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Today's Sessions</h2>
        {todaySessions.length > 0 ? (
          <ul className="space-y-1">
            {todaySessions.map((s, i) => (
              <li key={i} className="text-gray-800">• {s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No training today — rest up!</p>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Ask Your Coach</h2>
        <textarea
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-700 mb-3"
          placeholder="Ask your coach anything about your training..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          onClick={askCoach}
          className="px-6 py-2 rounded-full bg-black text-white text-sm font-semibold"
        >
          Send to Coach
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Coach Responses</h2>
        {response ? (
          <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{response}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">No questions asked yet.</p>
        )}
      </section>
    </main>
  );
}
