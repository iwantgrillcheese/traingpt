'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '../components/footer';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

const quotes = [
  "Don't count the days, make the days count.",
  "Discipline is doing it when you don’t feel like it.",
  "Train hard, race easy.",
  "Little by little, a little becomes a lot.",
  "The only bad workout is the one you didn’t do."
];

const steps = [
  'Authenticating with Supabase...',
  'Checking for existing plan...',
  'Building the perfect training prompt...',
  'Generating your plan with GPT...',
  'Saving plan to your dashboard...',
  'Almost done...'
];

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
};

export default function PlanPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    raceType: '',
    raceDate: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
    experience: '',
    maxHours: '',
    restDay: '',
  });
  const [userNote, setUserNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('');
  const [error, setError] = useState('');
  const [quote, setQuote] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFinalize = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + 1, 100);
        setStepText(steps[Math.floor((next / 100) * steps.length)] || steps[0]);
        return next;
      });
    }, 500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const access_token = session?.access_token;
      if (!access_token) throw new Error('No Supabase access token found');

      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ ...formData, userNote }),
      });

      if (!res.ok) throw new Error('Failed to finalize plan');
      await res.json();

      clearInterval(interval);
      router.push('/schedule');
    } catch (err: any) {
      clearInterval(interval);
      console.error('❌ Finalize plan error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkSessionAndPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSessionChecked(true);
        return;
      }

      const { data: planData } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planData) setHasPlan(true);
      setSessionChecked(true);
    };

    checkSessionAndPlan();
  }, []);

  const beginnerFields: FieldConfig[] = [
    { id: 'raceType', label: 'Race Type', type: 'select', options: ['Half Ironman (70.3)', 'Ironman (140.6)', 'Olympic', 'Sprint'] },
    { id: 'raceDate', label: 'Race Date', type: 'date' },
    { id: 'maxHours', label: 'Max Weekly Training Hours', type: 'number' },
    { id: 'experience', label: 'Experience Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] }
  ];

  const advancedFields: FieldConfig[] = [
    { id: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
    { id: 'runPace', label: 'Run Threshold Pace (min/mi)', type: 'text', placeholder: 'e.g. 7:30' },
    { id: 'swimPace', label: 'Swim Threshold Pace (per 100m)', type: 'text', placeholder: 'e.g. 1:38' },
    { id: 'restDay', label: 'Preferred Rest Day', type: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  ];

  if (!sessionChecked) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Checking your session...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {loading && (
        <div className="fixed inset-0 z-50 bg-white bg-opacity-90 flex flex-col items-center justify-center text-center px-6">
          <div className="w-full max-w-md">
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div className="bg-black h-4 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-500 mb-1">{stepText}</p>
            <p className="text-base text-gray-700 font-medium italic">{quote}</p>
          </div>
        </div>
      )}
      <Suspense fallback={<div className="py-32 text-center text-gray-400">Loading...</div>}>
        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold tracking-tight">{hasPlan ? 'Re-Generate Your Plan' : 'Generate Your Plan'}</h1>
            <p className="mt-3 text-gray-500 text-lg">{hasPlan ? 'This will replace your current training plan.' : 'We’ll personalize your training based on your inputs.'}</p>
          </div>

          {error && <p className="text-center text-red-600 mb-6 font-medium">{error}</p>}

          <form onSubmit={handleFinalize} className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {[...beginnerFields, ...(showAdvanced ? advancedFields : [])].map(({ id, label, type, options, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                {type === 'select' ? (
                  <select
                    id={id}
                    name={id}
                    value={formData[id as keyof typeof formData]}
                    onChange={handleChange}
                    className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                    required={!['bikeFTP', 'runPace', 'swimPace', 'restDay'].includes(id)}
                  >
                    <option value="">Select...</option>
                    {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                    required={!['bikeFTP', 'runPace', 'swimPace', 'restDay'].includes(id)}
                  />
                )}
              </div>
            ))}

            <div className="md:col-span-2">
              <label htmlFor="userNote" className="block text-sm font-medium text-gray-700 mb-1">Customize your plan (optional)</label>
              <textarea
                id="userNote"
                name="userNote"
                rows={3}
                placeholder="E.g. I’m targeting a 1:30 half marathon off the bike and need help with swim fitness..."
                value={userNote}
                onChange={e => setUserNote(e.target.value)}
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
                type="submit"
                disabled={loading}
                className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Generating…' : hasPlan ? 'Re-Generate Plan' : 'Generate Plan'}
              </button>
            </div>
          </form>
        </main>
      </Suspense>

      <Footer />
    </div>
  );
}
