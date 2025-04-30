// CoachingDashboard.tsx with voice input support

'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, formatDistanceToNow, parseISO, isAfter } from 'date-fns';
import Link from 'next/link';
import Head from 'next/head';

const supabase = createClientComponentClient();

function TypingDots() {
  return (
    <div className="flex space-x-1 justify-start items-center">
      <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" />
    </div>
  );
}

export default function CoachingDashboard() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: number; error?: boolean }[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<{ date: string; sessions: string[] }[]>([]);
  const [raceType, setRaceType] = useState('Olympic');
  const [raceDate, setRaceDate] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [stravaConnected, setStravaConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setQuestion((prev) => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    const fetchPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: plans } = await supabase
        .from('plans')
        .select('plan, race_type, race_date, experience')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (plans?.plan) {
        setRaceType(plans.race_type || 'Olympic');
        setRaceDate(plans.race_date || '');
        setExperienceLevel(plans.experience || 'Intermediate');

        const sessions: { date: string; sessions: string[] }[] = [];
        const todayDate = new Date(today);

        for (const week of plans.plan) {
          for (const [date, sessionList] of Object.entries(week.days)) {
            const parsedDate = new Date(date);
            if (parsedDate >= todayDate && sessions.length < 7) {
              sessions.push({ date, sessions: sessionList as string[] });
            }
          }
        }

        setUpcomingSessions(
          sessions.filter(({ date }) => isAfter(parseISO(date), new Date())).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()).slice(0, 3)
        );
      }

      const { data: stravaData } = await supabase
        .from('profiles')
        .select('strava_access_token')
        .eq('id', session.user.id)
        .single();

      if (stravaData?.strava_access_token) {
        setStravaConnected(true);
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

    const now = Date.now();
    const newMessages = [
      ...messages,
      { role: 'user' as const, content: question, timestamp: now },
      { role: 'assistant' as const, content: 'Thinking...', timestamp: now },
    ];

    setMessages(newMessages);

    try {
      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: question, timestamp: now }].slice(-8),
          completedSessions: upcomingSessions.flatMap((s) => s.sessions),
          userNote: question,
          raceType,
          raceDate,
          experienceLevel,
        }),
      });

      const data = await res.json();

      if (res.ok && data?.feedback) {
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: data.feedback, timestamp: Date.now() }]);
      } else {
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: 'Sorry, something went wrong. Try again.', timestamp: Date.now(), error: true }]);
      }
    } catch {
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: 'Sorry, something went wrong. Try again.', timestamp: Date.now(), error: true }]);
    } finally {
      setQuestion('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askCoach();
    }
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="flex flex-col min-h-screen max-w-4xl mx-auto px-4 pb-28 sm:px-6">
        {/* Ask Your Coach Section */}
        <section className="flex-1 border border-gray-200 rounded-xl p-4 shadow-md bg-white mb-8 overflow-y-auto max-h-[50vh]">
          <h3 className="text-base font-medium text-gray-800 mb-2">Ask Your Coach</h3>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Ask your coach anything about your training...</p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-900'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-xs">{msg.role === 'user' ? 'You' : '🏆 Coach'}</span>
                    <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</span>
                  </div>
                  {msg.content === 'Thinking...' ? <TypingDots /> : <p>{msg.content}</p>}
                  {msg.error && <button className="mt-1 text-xs text-red-600 underline" onClick={() => setQuestion(messages[messages.length - 2]?.content || '')}>Retry</button>}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </section>

        {/* Sticky Input Bar with Mic */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 px-4 py-3 z-10 max-w-4xl mx-auto flex gap-2">
          <textarea
            className="flex-1 border rounded-xl px-4 py-2 text-sm resize-none focus:outline-none"
            placeholder="Ask your coach anything..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={() => {
              if (isListening) {
                recognitionRef.current?.stop();
              } else {
                recognitionRef.current?.start();
                setIsListening(true);
              }
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${isListening ? 'bg-red-100 text-red-600 border-red-500' : 'bg-white text-gray-700 border-gray-300'}`}
          >
            🎙️
          </button>
          <button
            onClick={askCoach}
            disabled={!question.trim()}
            className="px-6 py-2 bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {question.trim() ? 'Send' : 'Type...'}
          </button>
        </div>
      </main>
    </>
  );
}
