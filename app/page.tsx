'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';
import { createClient, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
};

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [formData, setFormData] = useState({
    raceType: '',
    raceDate: '',
    maxHours: '',
    experience: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
    restDay: '',
  });

  useEffect(() => {
    const checkSessionAndPlan = async (incomingSession?: Session | null) => {
      const activeSession = incomingSession ?? (await supabase.auth.getSession()).data.session;
      setSession(activeSession);

      if (activeSession?.user) {
        const { data: planData } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', activeSession.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planData?.id) {
          setHasPlan(true);
          localStorage.setItem('user_has_plan', 'true');
        } else {
          setHasPlan(false);
          localStorage.setItem('user_has_plan', 'false');
        }

        localStorage.setItem('user_session_exists', 'true');
      } else {
        setHasPlan(false);
        localStorage.setItem('user_session_exists', 'false');
        localStorage.setItem('user_has_plan', 'false');
      }

      setChecking(false);
    };

    // Initial check
    checkSessionAndPlan();

    // Listen for session changes too (important for reloads)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, updatedSession) => {
      checkSessionAndPlan(updatedSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const beginnerFields: FieldConfig[] = [
    { id: 'raceType', label: 'Race Type', type: 'select', options: ['Half Ironman (70.3)', 'Ironman (140.6)', 'Olympic', 'Sprint'] },
    { id: 'raceDate', label: 'Race Date', type: 'date' },
    { id: 'maxHours', label: 'Max Weekly Training Hours', type: 'number' },
    { id: 'experience', label: 'Experience Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
  ];

  const advancedFields: FieldConfig[] = [
    { id: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
    { id: 'runPace', label: 'Run Threshold Pace (min/mi)', type: 'text', placeholder: 'e.g. 7:30' },
    { id: 'swimPace', label: 'Swim Threshold Pace (per 100m)', type: 'text', placeholder: 'e.g. 1:38' },
    { id: 'restDay', label: 'Preferred Rest Day', type: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  ];

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-gray-500 text-center px-6">
        <div className="w-12 h-12 mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-black border-b-transparent animate-spin"></div>
        </div>
        <p className="text-sm text-gray-600">Loading your training...</p>
      </div>
    );
  }

  if (session && hasPlan) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold tracking-tight">You already have a training plan!</h1>
            <p className="mt-3 text-gray-500 text-lg">Want to view or re-roll?</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 flex flex-col items-center text-center space-y-4">
            <div className="flex gap-4">
              <button
                className="bg-black text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-gray-800"
                onClick={() => router.push('/plan')}
              >
                Re-generate Plan
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded-full text-sm font-medium hover:bg-gray-400"
                onClick={() => router.push('/schedule')}
              >
                View Current Plan
              </button>
            </div>
          </div>
        </main>

        <div className="max-w-screen-xl mx-auto px-6">
          <BlogPreview />
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">
            Smarter Endurance Plans. Instantly.
          </h1>
          <p className="mt-3 text-gray-500 text-lg">
            Generate your personalized triathlon training plan in seconds.
          </p>
        </div>

        <form className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {[...beginnerFields, ...(showAdvanced ? advancedFields : [])].map(({ id, label, type, options, placeholder }) => (
            <div key={id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              {type === 'select' ? (
                <select
                  id={id}
                  name={id}
                  value={formData[id as keyof typeof formData]}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                >
                  <option value="">Select...</option>
                  {options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={type}
                  id={id}
                  name={id}
                  placeholder={placeholder}
                  value={formData[id as keyof typeof formData]}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                />
              )}
            </div>
          ))}

          <div className="md:col-span-2">
            <label htmlFor="userNote" className="block text-sm font-medium text-gray-700 mb-1">
              Customize your plan (optional)
            </label>
            <textarea
              id="userNote"
              name="userNote"
              rows={3}
              value={userNote}
              onChange={e => setUserNote(e.target.value)}
              placeholder="E.g. I’m targeting a 1:30 half marathon off the bike and need help with swim fitness..."
              className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-center space-x-3 mt-2">
            <span className="text-sm text-gray-600">Advanced Options</span>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showAdvanced ? 'bg-black' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAdvanced ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="md:col-span-2 text-center mt-4">
            <button
              type="button"
              onClick={() => {
                if (!session) router.push('/login');
                else router.push('/plan');
              }}
              className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800"
            >
              {session ? 'Generate Plan' : 'Sign in to Generate Your Plan'}
            </button>
          </div>
        </form>
      </main>

      <div className="max-w-screen-xl mx-auto px-6">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
