// app/coaching/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createClientComponentClient();

export default function CoachingPage() {
  const [plan, setPlan] = useState<any[]>([]);
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<{ user: string; coach: string; date: string }[]>([]);

  useEffect(() => {
    const fetchPlanAndMessages = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;

        const { data: plans } = await supabase
          .from('plans')
          .select('plan')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (plans?.plan) setPlan(plans.plan);

        const { data: coachingMessages } = await supabase
          .from('coaching_messages')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true });

        if (coachingMessages) setMessages(coachingMessages);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchPlanAndMessages();
  }, []);

  const handleAskCoach = async () => {
    if (!question.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ask-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (res.ok) {
        const { userMessage, coachReply } = await res.json();
        setMessages(prev => [...prev, { user: userMessage, coach: coachReply, date: new Date().toISOString() }]);
        setQuestion('');
      } else {
        throw new Error('Failed to send question');
      }
    } catch (err) {
      console.error('Error asking coach:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <h1 className="text-3xl font-bold mb-8">Coaching Dashboard</h1>

      {/* Today's Sessions */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Today's Sessions</h2>
        <div className="space-y-2">
          {plan.length > 0 ? plan.flatMap((week: any) =>
            Object.entries(week.days || {}).map(([dateStr, sessions]: [string, any]) => {
              if (format(parseISO(dateStr), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                return sessions.map((session: string, idx: number) => (
                  <div key={idx} className="border rounded-lg p-3 bg-white shadow-sm">
                    {session}
                  </div>
                ));
              }
              return null;
            })
          ).filter(Boolean) : <p className="text-gray-500">No sessions today.</p>}
        </div>
      </section>

      {/* Ask your coach */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Ask Your Coach</h2>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 text-sm"
          placeholder="Ask your coach anything about your training..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
        />
        <button
          onClick={handleAskCoach}
          disabled={isSubmitting}
          className={`w-full sm:w-auto px-6 py-2 rounded-full font-semibold text-sm text-white transition ${
            isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
          }`}
        >
          {isSubmitting ? 'Sending...' : 'Send to Coach'}
        </button>
      </section>

      {/* Conversation History */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Coach Responses</h2>
        <div className="space-y-6">
          {messages.length > 0 ? messages.map((m, idx) => (
            <div key={idx} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500 mb-2">{format(parseISO(m.date), 'MMM d, yyyy')}</div>
              <div className="mb-2">
                <strong className="text-gray-700">You:</strong>
                <p className="text-gray-800 mt-1">{m.user}</p>
              </div>
              <div>
                <strong className="text-gray-700">Coach:</strong>
                <p className="text-gray-800 mt-1">{m.coach}</p>
              </div>
            </div>
          )) : (
            <p className="text-gray-500">No questions asked yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
