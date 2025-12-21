'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '../components/footer';
import { supabase } from '@/lib/supabase-client';

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
};

const STEPS = [
  'Locking in your race goals and timeline…',
  'Scanning your notes like a seasoned coach…',
  'Cooking up a strong base phase…',
  'Dialing in your build block and key workouts…',
  'Balancing rest, bricks, and long sessions…',
  'Polishing the final weeks for race day…',
  'Still working — longer plans can take 2–4 minutes. Keep this tab open.',
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

  // “error” is used for truly blocking errors.
  const [error, setError] = useState<string>('');

  // “notice” is used for “still generating / keep waiting” type messaging.
  const [notice, setNotice] = useState<string>('');

  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);

  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [statusLine, setStatusLine] = useState<string>('Starting…');
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const runningTypes = useMemo(() => ['5k', '10k', 'Half Marathon', 'Marathon'], []);
  const isRunningPlan = runningTypes.includes(formData.raceType);

  /* -------------------- Clean up polling on unmount -------------------- */
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, []);

  /* -------------------- Loading Animation (real slowdown) -------------------- */
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setStepIndex(0);
      setElapsedSec(0);
      setStatusLine('Starting…');
      startTimeRef.current = null;
      return;
    }

    startTimeRef.current = Date.now();

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const startedAt = startTimeRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      const elapsedS = Math.floor(elapsed / 1000);
      setElapsedSec(elapsedS);

      // Step cadence slows after 45s (feels more believable)
      const delay = elapsed > 45_000 ? 3500 : 1500;

      setStepIndex((prev) => (prev + 1) % STEPS.length);

      setProgress((prev) => {
        if (prev >= 95) return prev;
        const bump = elapsed > 60_000 ? 1 : 3;
        return Math.min(95, prev + bump);
      });

      setTimeout(tick, delay);
    };

    const t = setTimeout(tick, 1200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [loading]);

  /* -------------------- Form Handling -------------------- */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* -------------------- Submit Handler -------------------- */
  const handleFinalize = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError('');
    setNotice('');
    setStatusLine('Starting generation…');

    const POLL_INTERVAL_MS = 2500;
    const POLL_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const access_token = session?.access_token || null;
      const userId = session?.user?.id || null;

      if (!access_token) throw new Error('No Supabase access token found.');
      if (!userId) throw new Error('No user found.');

      const planType = isRunningPlan ? 'running' : 'triathlon';

      // Helper: check if plan row exists (useful for better messaging)
      const checkPlanExists = async () => {
        const { data, error: planErr } = await supabase
          .from('plans')
          .select('id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planErr) return { exists: false, id: null as string | null };
        return { exists: !!data?.id, id: (data?.id as string) ?? null };
      };

      // Helper: check if sessions exist (signals schedule ready)
      const checkSessionsReady = async () => {
        const { count, error: countErr } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countErr) return { ready: false, count: 0 };
        return { ready: (count ?? 0) > 0, count: count ?? 0 };
      };

      // Polling loop
      const pollUntilReady = async () => {
        const startedAt = Date.now();

        // Clear any previous poll
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        return await new Promise<void>((resolve, reject) => {
          pollTimerRef.current = setInterval(async () => {
            const elapsed = Date.now() - startedAt;

            // Progress “anchors” (functional updates; no stale closure bugs)
            if (elapsed > 60_000) setProgress((p) => Math.max(p, 85));
            if (elapsed > 120_000) setProgress((p) => Math.max(p, 92));

            // Upgrade messaging as we learn more
            const [{ exists: planExists }, sessionsStatus] = await Promise.all([
              checkPlanExists(),
              checkSessionsReady(),
            ]);

            if (planExists && !sessionsStatus.ready) {
              setStatusLine('Plan created — saving workouts to your calendar…');
            } else if (!planExists) {
              setStatusLine('Generating your plan…');
            } else if (sessionsStatus.ready) {
              setStatusLine('Done — sending you to your schedule…');
            }

            if (sessionsStatus.ready) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;

              setProgress(100);
              setTimeout(() => router.push('/schedule'), 700);

              resolve();
              return;
            }

            if (elapsed >= POLL_TIMEOUT_MS) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;

              reject(
                new Error(
                  'Your plan is still generating in the background. This can happen on longer plans. Keep this tab open, or open Schedule and refresh in a minute.'
                )
              );
            }
          }, POLL_INTERVAL_MS);
        });
      };

      // Kick off plan generation request (but DO NOT assume JSON response)
      setStatusLine('Submitting your inputs…');

      let res: Response | null = null;
      let resText = '';
      let resJson: any = null;

      try {
        res = await fetch('/api/finalize-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${access_token}`,
          },
          body: JSON.stringify({
            ...formData,
            userNote,
            planType,
          }),
        });

        // Read as text first (handles HTML timeouts gracefully)
        resText = await res.text();
        try {
          resJson = JSON.parse(resText);
        } catch {
          resJson = null; // likely HTML (e.g. 524) or empty
        }
      } catch {
        res = null;
        resJson = null;
      }

      // If API returned a real JSON error, surface it.
      // Otherwise treat as “started / still running” and poll.
      if (res && !res.ok && resJson?.error) {
        throw new Error(resJson.error);
      }

      // Start polling no matter what (key fallback behavior)
      setStatusLine('Generating your plan…');
      setProgress((prev) => (prev < 20 ? 20 : prev));

      await pollUntilReady();

      // (If we get here, we navigated to /schedule.)
    } catch (err: any) {
      console.error('❌ Finalize plan error:', err);

      const msg =
        err?.message || 'Something went wrong while generating your plan. Please try again.';

      // “still generating” should be a calm notice, not a red error
      if (/still generating/i.test(msg)) {
        setNotice(msg);
        setError('');
      } else {
        setError(msg);
        setNotice('');
      }

      setLoading(false);
    }
  };

  /* -------------------- Check for Existing Plan -------------------- */
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
        .maybeSingle();

      if (planData?.id) setHasPlan(true);
      setSessionChecked(true);
    };

    checkSessionAndPlan();
  }, []);

  /* -------------------- Field Configs -------------------- */
  const beginnerFields: FieldConfig[] = [
    {
      id: 'raceType',
      label: 'Race Type',
      type: 'select',
      options: [
        '5k',
        '10k',
        'Half Marathon',
        'Marathon',
        'Sprint',
        'Olympic',
        'Half Ironman (70.3)',
        'Ironman (140.6)',
      ],
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

  const advancedFields: FieldConfig[] = isRunningPlan
    ? [
        {
          id: 'runPace',
          label: 'Run Threshold Pace (min/mi)',
          type: 'text',
          placeholder: 'e.g. 7:30',
        },
        {
          id: 'restDay',
          label: 'Preferred Rest Day',
          type: 'select',
          options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
      ]
    : [
        { id: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
        {
          id: 'runPace',
          label: 'Run Threshold Pace (min/mi)',
          type: 'text',
          placeholder: 'e.g. 7:30',
        },
        {
          id: 'swimPace',
          label: 'Swim Threshold Pace (per 100m)',
          type: 'text',
          placeholder: 'e.g. 1:38',
        },
        {
          id: 'restDay',
          label: 'Preferred Rest Day',
          type: 'select',
          options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
      ];

  /* -------------------- UI Render -------------------- */
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Checking your session…
      </div>
    );
  }

  const title = hasPlan ? 'Re-Generate Your Plan' : 'Generate Your Plan';
  const subtitle = hasPlan
    ? 'This will replace your current training plan.'
    : 'We’ll personalize your training based on your inputs.';

  const handleGoToSchedule = () => router.push('/schedule');

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
          <div className="w-full max-w-lg">
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-900">Generating your plan</p>
              <p className="text-xs text-gray-500 mt-1">
                {statusLine} {elapsedSec > 0 ? `• ${elapsedSec}s` : ''}
              </p>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
              <div
                className="bg-black h-3 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-gray-700 text-sm mb-2">{STEPS[stepIndex]}</p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleGoToSchedule}
                className="text-sm px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
              >
                Go to Schedule
              </button>
              <button
                type="button"
                onClick={() => {
                  // UX: allow user to dismiss overlay and keep working
                  // (generation may still continue server-side)
                  setLoading(false);
                  setNotice(
                    'Plan generation is still running in the background. You can visit Schedule and refresh in a minute.'
                  );
                }}
                className="text-sm px-4 py-2 rounded-full border border-transparent text-gray-600 hover:text-gray-900 transition"
              >
                Hide
              </button>
            </div>

            <p className="text-[12px] text-gray-500 mt-4">
              Tip: very long plans can take a couple minutes — don’t close this tab.
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="py-32 text-center text-gray-400">Loading…</div>}>
        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-gray-500 text-lg">{subtitle}</p>
          </div>

          {/* Notice (non-blocking) */}
          {notice && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-center">
              <p className="text-gray-800 font-medium">{notice}</p>
              <p className="text-gray-500 text-sm mt-2">
                If you just submitted, your plan may have saved successfully. Head to{' '}
                <a className="underline" href="/schedule">
                  Schedule
                </a>{' '}
                and refresh.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGoToSchedule}
                  className="bg-black text-white px-5 py-2 rounded-full text-sm hover:bg-gray-800 transition"
                >
                  Open Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setNotice('')}
                  className="text-sm px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Error (blocking) */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center">
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-600/80 text-sm mt-2">
                Try again — and if you just submitted, check Schedule first in case it already saved.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGoToSchedule}
                  className="text-sm px-4 py-2 rounded-full border border-red-200 bg-white hover:bg-red-50 transition"
                >
                  Check Schedule
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={handleFinalize}
            className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
          >
            {[...beginnerFields, ...(showAdvanced ? advancedFields : [])].map(
              ({ id, label, type, options, placeholder }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  {type === 'select' ? (
                    <select
                      id={id}
                      name={id}
                      value={formData[id as keyof typeof formData]}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                      required={!['bikeFTP', 'runPace', 'swimPace', 'restDay'].includes(id)}
                    >
                      <option value="">Select…</option>
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
                      className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                      required={!['bikeFTP', 'runPace', 'swimPace', 'restDay'].includes(id)}
                    />
                  )}
                </div>
              )
            )}

            <div className="md:col-span-2">
              <label htmlFor="userNote" className="block text-sm font-medium text-gray-700 mb-1">
                Customize your plan (optional)
              </label>
              <textarea
                id="userNote"
                name="userNote"
                rows={3}
                placeholder="E.g. I’m targeting a 1:45 half marathon and prefer long runs on Sundays…"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                The more specific you are, the more “coach-like” the plan will feel.
              </p>
            </div>

            <div className="md:col-span-2 flex items-center justify-center space-x-3 mt-2">
              <span className="text-sm text-gray-600">Advanced Options</span>
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

            <div className="md:col-span-2 text-center mt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Generating…' : hasPlan ? 'Re-Generate Plan' : 'Generate Plan'}
              </button>

              <div className="mt-3 text-xs text-gray-500">
                Plans usually take 20–60 seconds. Full-distance or far-out races can take longer.
              </div>
            </div>
          </form>
        </main>
      </Suspense>

      <Footer />
    </div>
  );
}
