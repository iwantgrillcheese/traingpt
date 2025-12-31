'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

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
  const [authReady, setAuthReady] = useState(false);
  const [hasPlan, setHasPlan] = useState<boolean>(false);

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

  const beginnerFields: FieldConfig[] = [
    {
      id: 'raceType',
      label: 'Race Type',
      type: 'select',
      options: ['Half Ironman (70.3)', 'Ironman (140.6)', 'Olympic', 'Sprint'],
    },
    { id: 'raceDate', label: 'Race Date', type: 'date' },
    { id: 'maxHours', label: 'Max Weekly Training Hours', type: 'number' },
    {
      id: 'experience',
      label: 'Experience Level',
      type: 'select',
      options: ['Beginner', 'Intermediate', 'Advanced'],
    },
  ];

  const advancedFields: FieldConfig[] = [
    { id: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
    { id: 'runPace', label: 'Run Threshold Pace', type: 'text', placeholder: 'e.g. 7:30 / mile' },
    { id: 'swimPace', label: 'Swim Threshold Pace', type: 'text', placeholder: 'e.g. 1:38 / 100m' },
    {
      id: 'restDay',
      label: 'Preferred Rest Day',
      type: 'select',
      options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
  ];

  useEffect(() => {
    let alive = true;

    const loadPlanFlag = async (userId: string) => {
      const { data: planData, error } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.warn('[home] plan lookup error', error);
        setHasPlan(false);
        return;
      }

      setHasPlan(!!planData?.id);
    };

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) console.warn('[home] getSession error', error);

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setAuthReady(true);

        if (nextSession?.user?.id) await loadPlanFlag(nextSession.user.id);
        else setHasPlan(false);
      } catch (e) {
        if (!alive) return;
        console.warn('[home] getSession threw', e);
        setSession(null);
        setHasPlan(false);
        setAuthReady(true);
      }
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;
      setSession(s ?? null);
      setAuthReady(true);

      if (s?.user?.id) loadPlanFlag(s.user.id);
      else setHasPlan(false);
    });

    const onFocus = () => syncSession();
    window.addEventListener('focus', onFocus);

    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setAuthReady(true);
    }, 1500);

    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      window.clearTimeout(timeout);
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const primaryCtaLabel = useMemo(() => {
    if (!session) return 'Sign in to generate your plan';
    return 'Generate my plan';
  }, [session]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-white text-gray-500">
        <div className="w-12 h-12 mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-t-black border-b-transparent animate-spin" />
        </div>
        <p className="text-sm">Checking session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-28 left-1/2 -translate-x-1/2 h-[520px] w-[980px] rounded-full bg-gray-100 blur-3xl opacity-70" />
          <div className="absolute top-24 right-[-140px] h-[320px] w-[320px] rounded-full bg-gray-100 blur-3xl opacity-60" />
          <div className="absolute top-56 left-[-160px] h-[320px] w-[320px] rounded-full bg-gray-100 blur-3xl opacity-60" />
        </div>

        <main className="relative max-w-6xl mx-auto px-6 pt-16 pb-12">
          {session && hasPlan ? (
            <section className="max-w-3xl mx-auto">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />
                  Plan ready
                </div>

                <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight">
                  Your plan is already created.
                </h1>
                <p className="mt-3 text-gray-600 text-lg">
                  View your schedule, or re-generate if your goals changed.
                </p>
              </div>

              <div className="mt-8 bg-white border border-gray-200 shadow-sm rounded-2xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-center">
                  <button
                    className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800"
                    onClick={() => router.push('/schedule')}
                  >
                    View schedule
                  </button>
                  <button
                    className="bg-gray-50 text-gray-900 px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-100 border border-gray-200"
                    onClick={() => router.push('/plan')}
                  >
                    Re-generate plan
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left */}
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />
                  Free to start. No credit card required.
                </div>

                <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                  Generate a custom training plan in under a minute.
                </h1>

                <p className="mt-4 text-gray-600 text-lg leading-relaxed">
                  Pick your race, your date, and your weekly hours. Get a full schedule you can follow, track, and
                  adjust over time.
                </p>

                <div className="mt-7 grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                    <div className="font-medium">Instant plan</div>
                    <div className="mt-1 text-gray-600">A full schedule built around your race date.</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                    <div className="font-medium">Calendar tracking</div>
                    <div className="mt-1 text-gray-600">Check off sessions and stay consistent week to week.</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                    <div className="font-medium">Strava sync and feedback</div>
                    <div className="mt-1 text-gray-600">Pull in workouts and get guidance as you train.</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-gray-400" />
                    Takes about a minute
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-gray-400" />
                    Works great on mobile
                  </span>
                </div>
              </div>

              {/* Right */}
              <div className="lg:col-span-7 space-y-4">
                {/* Screenshot proof */}
                <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="text-sm font-medium">Preview</div>
                    <div className="text-xs text-gray-500">Schedule view</div>
                  </div>
                  <div className="relative w-full aspect-[16/10] bg-gray-50">
                    {/* Put a real screenshot at /public/landing/schedule.png */}
                    <Image
                      src="/landing/schedule.png"
                      alt="Schedule calendar screenshot"
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>

                {/* Form */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">Create your plan</h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Start simple. Add advanced details if you want.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Advanced</span>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          showAdvanced ? 'bg-black' : 'bg-gray-300'
                        }`}
                        aria-label="Toggle advanced options"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            showAdvanced ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[...beginnerFields, ...(showAdvanced ? advancedFields : [])].map(
                      ({ id, label, type, options, placeholder }) => (
                        <div key={id}>
                          <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
                          {type === 'select' ? (
                            <select
                              id={id}
                              name={id}
                              value={formData[id as keyof typeof formData]}
                              onChange={handleChange}
                              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                            >
                              <option value="">Select...</option>
                              {options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
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
                              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                            />
                          )}
                        </div>
                      )
                    )}

                    <div className="md:col-span-2">
                      <label htmlFor="userNote" className="block text-sm font-medium text-gray-800 mb-1">
                        Custom notes (optional)
                      </label>
                      <textarea
                        id="userNote"
                        name="userNote"
                        rows={3}
                        value={userNote}
                        onChange={(e) => setUserNote(e.target.value)}
                        placeholder="E.g. prefer long ride Saturday, want swim focus, returning from a minor injury"
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>

                    <div className="md:col-span-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!session) router.push('/login');
                          else router.push('/plan');
                        }}
                        className="w-full bg-black text-white px-8 py-3.5 rounded-full font-medium hover:bg-gray-800"
                      >
                        {primaryCtaLabel}
                      </button>

                      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          Free to start
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          No credit card
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          Strava optional
                        </span>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Product sections with screenshots */}
      <div className="max-w-6xl mx-auto px-6 pb-14">
        <div className="border-t border-gray-200" />

        <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">A plan you can follow.</h2>
            <p className="mt-3 text-gray-600">
              Your schedule lives in a clean calendar view. Stay consistent by checking off sessions.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="relative w-full aspect-[16/10] bg-gray-50">
              <Image src="/landing/calendar.png" alt="Calendar screenshot" fill className="object-cover" />
            </div>
          </div>
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="order-2 md:order-1 rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="relative w-full aspect-[16/10] bg-gray-50">
              <Image src="/landing/coaching.png" alt="Coaching screenshot" fill className="object-cover" />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-2xl font-semibold tracking-tight">Feedback when you need it.</h2>
            <p className="mt-3 text-gray-600">
              Ask questions about pacing, fatigue, workouts, or race strategy. Get answers tied to your plan.
            </p>
          </div>
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sync with Strava.</h2>
            <p className="mt-3 text-gray-600">
              Pull in completed workouts automatically. Compare planned and completed training over time.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="relative w-full aspect-[16/10] bg-gray-50">
              <Image src="/landing/strava.png" alt="Strava sync screenshot" fill className="object-cover" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-10">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
