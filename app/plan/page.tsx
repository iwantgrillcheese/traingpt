'use client';

import React, { useState, useEffect } from 'react';
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

// ✅ Field config type
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
  const [previewPlan, setPreviewPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState('');

  useEffect(() => {
    const clearRedirectLogic = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        // skip auto-redirect logic to allow plan generation even if a plan exists
        console.log('[PlanPage] User session active — allowing access to form');
      }
    };
    clearRedirectLogic();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/preview-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userNote }),
      });
      if (!res.ok) throw new Error('Failed to generate preview');
      const preview = await res.json();
      setPreviewPlan(preview);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userNote }),
      });

      if (!res.ok) throw new Error('Failed to finalize plan');
      const finalPlan = await res.json();

      const { data: { session } } = await supabase.auth.getSession();
      const access_token = session?.access_token;
      if (!access_token) throw new Error('No Supabase access token found');

      const saveRes = await fetch('/api/save-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          plan: finalPlan,
          raceType: formData.raceType,
          raceDate: formData.raceDate,
          userNote: userNote || '',
        }),
      });

      const saveResult = await saveRes.json();
      console.log('✅ Saved to Supabase:', saveResult);

      localStorage.setItem('trainGPTPlan', JSON.stringify(finalPlan));
      router.push('/schedule');
    } catch (err: any) {
      console.error('❌ Finalize plan error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {(loading && !previewPlan) && (
        <div className="fixed inset-0 z-50 bg-white bg-opacity-90 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-black border-b-transparent animate-spin"></div>
          </div>
          <p className="text-lg text-gray-700 font-medium italic">{quote}</p>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">Generate Your Plan</h1>
          <p className="mt-3 text-gray-500 text-lg">We’ll personalize your training based on your inputs.</p>
        </div>

        {error && <p className="text-center text-red-600 mb-6 font-medium">{error}</p>}

        {!previewPlan && (
          <form onSubmit={handlePreview} className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                {loading ? 'Generating...' : 'Preview Plan'}
              </button>
            </div>
          </form>
        )}

        {previewPlan && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6 text-center">5-Day Plan Preview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(previewPlan).slice(0, 5).map(([day, sessions]) => (
                <div key={day} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{day}</h3>
                  <ul className="space-y-1 text-sm text-gray-800">
                    {(sessions as string[]).map((s, i) => (
                      <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center space-x-4">
              <button
                onClick={handleFinalize}
                disabled={loading}
                className="px-6 py-3 bg-black text-white font-semibold rounded-full hover:bg-gray-800 transition disabled:opacity-50"
              >
                {loading ? 'Saving Plan...' : '✅ Finalize Plan'}
              </button>
              <button
                onClick={() => setPreviewPlan(null)}
                className="mt-3 px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition"
              >
                ⏪ Go Back
              </button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
