'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDistanceToNow } from 'date-fns';

const supabase = createClientComponentClient();

function TypingDots() {
  return (
    <div className="flex space-x-1 justify-start items-center">
      <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></div>
    </div>
  );
}

export default function CoachingDashboard() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: number; error?: boolean }[]>([]);
  const [todaySessions, setTodaySessions] = useState<string[]>([]);
  const [raceType, setRaceType] = useState('Olympic');
  const [raceDate, setRaceDate] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: plans, error } = await supabase
        .from('plans')
        .select('plan')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && plans?.plan) {
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
  }, [messages]);

  const askCoach = async () => {
    if (!question.trim()) return;

    const newMessages: { role: 'user' | 'assistant'; content: string; timestamp: number; error?: boolean }[] = [
      ...messages,
      { role: 'user', content: question, timestamp: Date.now() },
      { role: 'assistant', content: 'Thinking...', timestamp: Date.now() },
    ];

    setMessages(newMessages);

    try {
      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: question }].slice(-8),
          completedSessions: todaySessions,
          userNote: question,
          raceType,
          raceDate,
          experienceLevel,
        }),
      });

      const data = await res.json();

      if (res.ok && data?.feedback) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: data.feedback, timestamp: Date.now() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: 'Sorry, something went wrong. Try again.', timestamp: Date.now(), error: true },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Sorry, something went wrong. Try again.', timestamp: Date.now(), error: true },
      ]);
    } finally {
      setQuestion('');
    }
  };

  return (
    <main className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Top Header */}
      <header className="px-4 pt-6 pb-4 sm:px-6">
        <h1 className="text-2xl font-bold">Coaching Dashboard</h1>
      </header>

      {/* Today's Sessions */}
      <section className="px-4 sm:px-6">
        <h2 className="text-lg font-semibold mb-2">Today's Sessions</h2>
        {todaySessions.length > 0 ? (
          <ul className="space-y-1 text-gray-700">
            {todaySessions.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No training today — rest up!</p>
        )}
      </section>

      {/* Chat Area */}
      <section className="flex-1 overflow-y-auto px-4 sm:px-6 mt-6 space-y-6">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Ask your coach anything about today's training...</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-900'} animate-fade-in`}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-semibold">{msg.role === 'user' ? 'You' : '🏆 Coach'}</p>
                <p className="text-[10px] text-gray-400">
                  {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                </p>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content === 'Thinking...' ? <TypingDots /> : msg.content}
              </p>
              {msg.error && (
                <button
                  className="mt-2 text-xs text-red-600 underline"
                  onClick={() => setQuestion(messages[messages.length - 2]?.content || '')}
                >
                  Retry
                </button>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </section>

      {/* Input Bar */}
      <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
        <textarea
          className="flex-1 border rounded-xl px-4 py-2 text-sm resize-none"
          placeholder="Ask your coach anything..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={1}
        />
        <button
          onClick={askCoach}
          disabled={!question.trim()}
          className="px-6 py-2 bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {question.trim() ? 'Send' : 'Type...'}
        </button>
      </div>
    </main>
  );
}
