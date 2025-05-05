'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, formatDistanceToNow, parseISO, isAfter, subDays, startOfDay } from 'date-fns';
import Link from 'next/link';
import Head from 'next/head';
import { useMediaQuery } from 'react-responsive';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import TypingDots from '@/components/TypingDots'; // ✅ Ensure this exists

const supabase = createClientComponentClient();
const COLORS = ['#60A5FA', '#34D399', '#FBBF24'];

type ChatMessage = {
  role: string;
  content: string;
  timestamp: number;
  error?: boolean;
};

export default function CoachingDashboard() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hey, I’m your AI coach. Ask me anything about your training and I’ll do my best to help.",
      timestamp: Date.now(),
    },
  ]);
  const [upcomingSessions, setUpcomingSessions] = useState<{ date: string; sessions: string[] }[]>([]);
  const [raceType, setRaceType] = useState('Olympic');
  const [raceDate, setRaceDate] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaData, setStravaData] = useState<
    { sport_type: string; moving_time: number; start_date_local: string }[] | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery({ query: '(max-width: 640px)' });
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchPlanAndStrava = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const { data: plans } = await supabase
        .from('plans')
        .select('plan, race_type, race_date, experience')
        .eq('user_id', user.id)
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

        setUpcomingSessions(sessions
          .filter(({ date }) => isAfter(parseISO(date), new Date()))
          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
          .slice(0, 3));
      }

      const { data: stravaProfile } = await supabase
        .from('profiles')
        .select('strava_access_token')
        .eq('id', user.id)
        .single();

      if (stravaProfile?.strava_access_token) {
        setStravaConnected(true);
        await fetch('/api/strava_sync');

        const { data: activities } = await supabase
          .from('strava_activities')
          .select('sport_type, moving_time, start_date_local')
          .eq('user_id', user.id)
          .gte('start_date_local', startOfDay(subDays(new Date(), 28)).toISOString());

        if (activities) setStravaData(activities);
      }
    };

    fetchPlanAndStrava();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const askCoach = async () => {
    if (!question.trim()) return;
    const now = Date.now();
    const userMessage = { role: 'user', content: question.trim(), timestamp: now };
    const loadingMessage = { role: 'assistant', content: 'Thinking...', timestamp: now };
    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setQuestion('');

    try {
      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-8),
          completedSessions: upcomingSessions.flatMap((s) => s.sessions),
          userNote: question,
          raceType,
          raceDate,
          experienceLevel,
        }),
      });

      const data = await res.json();
      const response = res.ok && data?.feedback
        ? { role: 'assistant', content: data.feedback, timestamp: Date.now() }
        : { role: 'assistant', content: 'Sorry, something went wrong. Try again.', timestamp: Date.now(), error: true };

      setMessages((prev) => [...prev.slice(0, -1), response]);
    } catch {
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: 'Sorry, something went wrong. Try again.', timestamp: Date.now(), error: true }]);
    }
  };

  const ChatBox = () => (
    <div className="border border-gray-200 rounded-xl p-4 shadow bg-white max-h-[60vh] overflow-y-auto mb-4">
      {messages.map((msg, i) => (
        <div key={i} className={`max-w-[85%] mb-2 p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-100 text-blue-900 ml-auto' : 'bg-gray-100 text-gray-900 mr-auto'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-xs">{msg.role === 'user' ? 'You' : '🏆 Coach'}</span>
            <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</span>
          </div>
          <p>{msg.content}</p>
          {msg.error && <button className="mt-1 text-xs text-red-600 underline" onClick={() => setQuestion(messages[messages.length - 2]?.content || '')}>Retry</button>}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );

  const DashboardSummary = () => {
    if (!stravaData) return null;

    const weeklyVolume = [0, 0, 0, 0];
    const sportTotals = { Swim: 0, Bike: 0, Run: 0 };
    const uniqueDays = new Set();

    for (const session of stravaData) {
      const date = parseISO(session.start_date_local);
      const weekIndex = Math.floor((Date.now() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weekIndex >= 0 && weekIndex < 4) {
        weeklyVolume[3 - weekIndex] += session.moving_time / 3600;
      }
      uniqueDays.add(format(date, 'yyyy-MM-dd'));
      const type = session.sport_type;
      if (sportTotals[type] !== undefined) {
        sportTotals[type] += session.moving_time / 3600;
      }
    }

    const totalTime = Object.values(sportTotals).reduce((a, b) => a + b, 0).toFixed(1);
    const chartData = Object.entries(sportTotals).map(([k, v]) => ({ name: k, value: v }));

    return (
      <section className="mt-10 mb-4">
        <h2 className="text-lg font-semibold mb-2">Training Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Time This Week</p>
            <p className="text-xl font-bold text-gray-800">{totalTime}h</p>
          </div>
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Training Consistency</p>
            <p className="text-xl font-bold text-gray-800">{uniqueDays.size} of last 7 days</p>
          </div>
          <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
            <p className="text-sm text-gray-500 mb-2">Weekly Volume (hrs)</p>
            <div className="flex items-end gap-2 h-20">
              {weeklyVolume.map((val, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="bg-blue-500 w-4 rounded" style={{ height: `${val * 10}px` }} title={`${val.toFixed(1)} hrs`} />
                  <span className="text-[10px] text-gray-500 mt-1">W{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded-xl p-4 bg-white shadow-sm col-span-1 sm:col-span-2">
            <p className="text-sm text-gray-500 mb-2">Sport Breakdown</p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8" label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex gap-4 justify-center mt-4 text-sm">
              {chartData.map((entry, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  {entry.name}: {entry.value.toFixed(1)}h
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="flex flex-col min-h-screen max-w-4xl mx-auto px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold mb-4">Your AI Coach</h1>
        <ChatBox />
        <div className="flex gap-3 sticky bottom-0 bg-white pt-2 pb-4">
          <textarea
            className="flex-1 border rounded-xl px-4 py-2 text-sm resize-none"
            placeholder="Ask your coach anything..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                askCoach();
              }
            }}
            rows={1}
          />
          <button
            onClick={askCoach}
            disabled={!question.trim()}
            className="px-6 py-2 bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            Send
          </button>
        </div>

        <section className="mb-10 mt-10">
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

        <div className="text-center mb-8">
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

        <div className="text-center text-sm text-gray-500 mt-auto">
          {raceType} | {experienceLevel} | {raceDate && `Race in ${formatDistanceToNow(new Date(raceDate), { addSuffix: true })}`}
        </div>

        <DashboardSummary />
      </main>
    </>
  );
}
