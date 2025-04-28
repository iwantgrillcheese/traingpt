// Full page with "Enter to send", "disable send while thinking", and "auto-focus after send"

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
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
          sessions
            .filter(({ date }) => isAfter(parseISO(date), new Date()))
            .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
            .slice(0, 3)
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

    const newMessages = [
      ...messages,
      { role: 'user', content: question, timestamp: Date.now() },
      { role: 'assistant', content: 'Thinking...', timestamp: Date.now() },
    ];
    setMessages(newMessages);
    setThinking(true);

    try {
      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: question, timestamp: Date.now() }].slice(-8),
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
      setThinking(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="flex flex-col min-h-screen max-w-4xl mx-auto px-4 py-6 sm:px-6">

        {/* Top Info */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Coaching Dashboard</h1>
          <div className="text-sm text-gray-500 mb-1">Race type: {raceType} | Experience: {experienceLevel}</div>
          {raceDate && (
            <div className="text-sm text-gray-500">
              Race in {formatDistanceToNow(new Date(raceDate), { addSuffix: true })}
            </div>
          )}
        </div>

        {/* Ask Your Coach */}
        <section className="flex-1 border border-gray-200 rounded-xl p-4 shadow-md bg-white mb-8">
          <h3 className="text-base font-medium text-gray-800 mb-2">Ask Your Coach</h3>
          <div className="space-y-4 max-h-[40vh] overflow-y-auto mb-4">
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
                  {msg.error && (
                    <button className="mt-1 text-xs text-red-600 underline" onClick={() => setQuestion(messages[messages.length - 2]?.content || '')}>
                      Retry
                    </button>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              className="flex-1 border rounded-xl px-4 py-2 text-sm resize-none"
              placeholder="Ask your coach anything..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  askCoach();
                }
              }}
            />
            <button
              onClick={askCoach}
              disabled={!question.trim() || thinking}
              className="px-6 py-2 bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {thinking ? 'Thinking...' : question.trim() ? 'Send' : 'Type...'}
            </button>
          </div>
        </section>

        {/* Upcoming Sessions */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-2">Upcoming Sessions</h2>
          {upcomingSessions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upcomingSessions.map(({ date, sessions }, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white">
                  <p className="text-sm font-medium text-gray-700 mb-2">{format(parseISO(date), 'EEEE, MMM d')}</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {sessions.map((s, j) => <li key={j}>• {s}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No upcoming training sessions found.</p>
          )}
        </section>

        {/* Strava Connect */}
        <div className="text-center mt-8">
          {stravaConnected ? (
            <div className="inline-flex items-center gap-2 px-5 py-3 border border-green-500 text-green-600 bg-green-50 rounded-xl">
              <img src="/strava-2.svg" alt="Strava" className="h-5 w-auto" />
              <span className="font-semibold text-sm">Connected to Strava ✅</span>
            </div>
          ) : (
            <Link
              href={`https://www.strava.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI}&approval_prompt=force&scope=activity:read_all`}
              className="inline-flex items-center gap-2 px-5 py-3 border border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl"
            >
              <img src="/strava-2.svg" alt="Strava" className="h-5 w-auto" />
              <span className="font-semibold text-sm">Connect to Strava</span>
            </Link>
          )}
        </div>

      </main>
    </>
  );
}
