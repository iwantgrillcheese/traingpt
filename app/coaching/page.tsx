'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export default function CoachingDashboard() {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState<{ question: string; answer: string }[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [todaySessions, setTodaySessions] = useState<string[]>([]);
  const [raceType, setRaceType] = useState('Olympic');
  const [raceDate, setRaceDate] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
        setPlan(plans.plan.plan || []);
        setRaceType(plans.plan.raceType || 'Olympic');
        setRaceDate(plans.plan.raceDate || '');
        setExperienceLevel(plans.plan.experience || 'Intermediate');

        const weekToday = plans.plan.plan.find((week: any) =>
          Object.keys(week.days).includes(today)
        );
        setTodaySessions(weekToday?.days[today] || []);
      }
    };

    fetchPlan();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [responses]);

  const askCoach = async () => {
    if (!question.trim()) return;

    setResponses(prev => [...prev, { question, answer: 'Thinking...' }]);

    try {
      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedSessions: todaySessions,
          userNote: question,
          raceType,
          raceDate,
          experienceLevel,
        }),
      });

      const data = await res.json();

      if (res.ok && data?.feedback) {
        setResponses(prev => [...prev.slice(0, -1), { question, answer: data.feedback }]);
      } else {
        setResponses(prev => [...prev.slice(0, -1), { question, answer: 'Sorry, something went wrong. Try again.' }]);
      }
    } catch (error) {
      console.error('Error asking coach:', error);
      setResponses(prev => [...prev.slice(0, -1), { question, answer: 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setQuestion('');
    }
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
          disabled={!question.trim()}
          className="px-6 py-2 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-50"
        >
          {question.trim() ? 'Send to Coach' : 'Type a Question'}
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Coach Responses</h2>
        {responses.length > 0 ? (
          <div className="space-y-6">
            {responses.map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-gray-100">
                <p className="text-sm text-gray-600 mb-2"><strong>You asked:</strong> {item.question}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {item.answer === 'Thinking...' ? <span className="animate-pulse">Thinking...</span> : item.answer}
                </p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No questions asked yet.</p>
        )}
      </section>
    </main>
  );
}
