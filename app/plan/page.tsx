'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '../components/footer';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
};

const supabase = createClientComponentClient();

const quotes = [
  "Success comes from knowing you did your best to become the best you’re capable of becoming. — John Wooden",
  "You do not rise to the level of your goals. You fall to the level of your systems. — James Clear",
  "The body builds strength through stress, then rest. So does the mind.",
  "No man is free who is not master of himself. — Epictetus",
  "Discipline is choosing what you want most over what you want now.",
  "Don’t wish it were easier. Train to be better.",
  "Every session compounds. Show up.",
  "How you do anything is how you do everything.",
  "We suffer more in imagination than in reality. — Seneca",
  "Motivation gets you started. Consistency keeps you going.",
  "Effort counts twice. — Angela Duckworth",
  "If it matters, make time. If not, be honest about that too.",
  "The race is won in training. The finish line just proves it.",
  "Small improvements, repeated daily, lead to exceptional results.",
  "What stands in the way becomes the way. — Marcus Aurelius"
];

const steps = [
  'Locking in your race goals and timeline...',
  'Scanning your notes like a seasoned coach...',
  'Cooking up a solid base phase...',
  'Dialing in the build block to get you race ready...',
  'Balancing rest days, bricks, and long sessions...',
  'Polishing the plan for game day...'
];

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
  const [error, setError] = useState('');
  const [quote, setQuote] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setStepIndex(prev => (prev + 1) % steps.length);
        setProgress(prev => (prev < 100 ? prev + 100 / steps.length : 100));
      }, 6000);
    } else {
      setProgress(0);
      setStepIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFinalize = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const access_token = session?.access_token || null;
      if (!access_token) throw new Error('No Supabase access token found');

      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ ...formData, userNote }),
      });

const json = await res.json();

if (!res.ok) {
  if (json.code === 'TOO_MANY_WEEKS') {
  const maxWeeks = json.maxWeeks;
  const basePlanStart = new Date();
  const basePlanEnd = new Date();
  basePlanEnd.setDate(basePlanStart.getDate() + maxWeeks * 7);

  setError(`Your race is a bit far out. We currently support up to ${maxWeeks} weeks of training.`);

  setFormData(prev => ({
    ...prev,
    raceDate: basePlanEnd.toISOString().split('T')[0],
  }));
  setUserNote('Build a strong base phase until my actual race-specific training starts.');

  return;
}

  if (json.code === 'TOO_FEW_WEEKS') {
    setError(`That race is a bit too soon. We recommend at least ${json.minWeeks} weeks to prepare properly.`);

    const confirmTaper = confirm(`Want a short taper and race-week strategy instead?`);
    if (confirmTaper) {
      setUserNote('Build a taper-focused plan for my upcoming race.');
      document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }

    return;
  }

  throw new Error(json.error || 'Failed to finalize plan');
}

      router.push('/schedule');
    } catch (err: any) {
      console.error('❌ Finalize plan error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkSessionAndPlan = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
  { id: 'experience', label: 'Experience Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
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
            <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
              <div className="bg-black h-4 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-gray-600 text-sm mb-2">{steps[stepIndex]}</p>
            <p className="text-gray-800 italic text-base font-medium">{quote}</p>
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
                    {options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
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
