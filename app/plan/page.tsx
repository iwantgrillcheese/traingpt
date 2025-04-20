'use client';

import React, { useState } from 'react';
import { useEffect } from 'react'
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
const supabase = createClientComponentClient();
import Footer from '../components/footer';

const quotes = [
  "Don't count the days, make the days count.",
  "Discipline is doing it when you don’t feel like it.",
  "Train hard, race easy.",
  "Little by little, a little becomes a lot.",
  "The only bad workout is the one you didn’t do."
];

const blogPosts = [
  {
    title: 'Crush Your Brick Workouts',
    description: 'How to train your body to switch from bike to run like a pro.',
    tag: 'Training Tip',
    date: 'Apr 16, 2025',
    href: '/blog/brick-workouts',
    image: '/tiles/brick.webp',
  },
  {
    title: 'You Don’t Need More Motivation',
    description: 'Consistency beats hype. Here’s how to build it.',
    tag: 'Mindset',
    date: 'Apr 15, 2025',
    href: '/blog/consistency-vs-motivation',
    image: '/tiles/consistency.webp',
  },
  {
    title: 'How We Train Smarter with AI',
    description: 'The coaching logic behind your plan and why it works.',
    tag: 'Product',
    date: 'Apr 14, 2025',
    href: '/blog/ai-training-engine',
    image: '/tiles/ai-engine.webp',
  },
];

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
  
      const {
        data: { session },
      } = await supabase.auth.getSession();
  
      console.log('🧪 SESSION LOG:', session);
    })();
  }, []);

  const [formData, setFormData] = useState({
    raceType: '',
    raceDate: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
    experience: '',
    maxHours: '',
    restDay: ''
  });

  const [userNote, setUserNote] = useState('');
  const [previewPlan, setPreviewPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/preview-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to generate preview.');
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
    setShowOverlay(true);
    setError('');
  
    try {
      const res = await fetch('/api/finalize-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userNote }),
      });
  
      if (!res.ok) throw new Error('Failed to finalize plan');
      const finalPlan = await res.json();
  
      console.log('📤 Saving to Supabase:', {
        plan: finalPlan,
        raceType: formData.raceType,
        raceDate: formData.raceDate,
        userNote: userNote || '',
      });
  
      // 🧠 Get Supabase session properly
      const { data: { session } } = await supabase.auth.getSession();
const access_token = session?.access_token

if (!access_token) throw new Error('No Supabase access token found');;      
  
      // 2. Save to Supabase
      const saveRes = await fetch('/api/save-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: Bearer ${access_token},
        },
        body: JSON.stringify({
          plan: finalPlan,
          raceType: formData.raceType,
          raceDate: formData.raceDate,
          userNote: userNote || '',
        }),
      });
  
      const saveResult = await saveRes.json();
      console.log('✅ Supabase response:', saveResult);
  
      localStorage.setItem('trainGPTPlan', JSON.stringify(finalPlan));
      router.push('/schedule');
    } catch (err: any) {
      console.error('❌ Finalize plan error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">Smarter Endurance Plans. Instantly.</h1>
          <p className="mt-3 text-gray-500 text-lg">Generate your personalized triathlon training plan in seconds.</p>
        </div>

        {error && <p className="text-center text-red-600 mb-6 font-medium">{error}</p>}

        {!previewPlan && (
          <form onSubmit={handlePreview} className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { id: 'raceType', label: 'Race Type', type: 'select', options: ['Half Ironman (70.3)', 'Ironman (140.6)', 'Olympic', 'Sprint'] },
              { id: 'raceDate', label: 'Race Date', type: 'date' },
              { id: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
              { id: 'runPace', label: 'Run Threshold Pace (min/mi)', type: 'text', placeholder: 'e.g. 7:30' },
              { id: 'swimPace', label: 'Swim Threshold Pace (per 100m)', type: 'text', placeholder: 'e.g. 1:38' },
              { id: 'experience', label: 'Experience Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
              { id: 'maxHours', label: 'Max Weekly Training Hours', type: 'number' },
              { id: 'restDay', label: 'Preferred Rest Day', type: 'select', options: ['Sunday', 'Monday', 'Friday'] }
            ].map(({ id, label, type, options, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                {type === 'select' ? (
                  <select id={id} name={id} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm">
                    <option value="">Select...</option>
                    {options?.map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input type={type} id={id} name={id} placeholder={placeholder} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm" />
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

            <div className="md:col-span-2 text-center mt-4">
              <button type="submit" disabled={loading} className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-50">
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
              <button onClick={handleFinalize} disabled={loading} className="px-6 py-3 bg-black text-white font-semibold rounded-full hover:bg-gray-800 transition disabled:opacity-50">
                {loading ? 'Saving Plan...' : '✅ Finalize Plan'}
              </button>
              <button onClick={() => setPreviewPlan(null)} className="mt-3 px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition">
                ⏪ Go Back
              </button>
            </div>
          </div>
        )}

        <section className="mt-24">
          <h2 className="text-2xl font-semibold mb-4 tracking-tight">Everything You Need to Crush Your Training</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {blogPosts.map(({ title, description, tag, date, href, image }) => (
              <Link key={href} href={href} className="block rounded-2xl overflow-hidden hover:shadow-xl transition">
                <div className="h-48 bg-cover bg-center" style={{ backgroundImage: url(${image}) }}></div>
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-1">{tag} · {date}</p>
                  <h3 className="text-lg font-semibold leading-tight mb-1">{title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {showOverlay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex-col items-center justify-center flex">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white mb-6" />
          <p className="text-white text-lg font-medium text-center max-w-xs">{randomQuote}</p>
        </div>
      )}

      <Footer />
    </div>
  );
}
