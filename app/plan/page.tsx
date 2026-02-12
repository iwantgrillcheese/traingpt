'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Footer from '../components/footer';
import { supabase } from '@/lib/supabase-client';
import PostPlanWalkthrough from './components/PostPlanWalkthrough';
import type { WalkthroughContext } from '@/types/coachGuides';

export const dynamic = 'force-dynamic';

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
};

type VoicePlanSummary = {
  raceType: string;
  raceDate: string;
  experience: string;
  goalTime: string;
  concerns: string;
  availability: string;
  stravaBaseline: string;
};

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const VOICE_PLAN_FIELDS: Array<{ key: keyof VoicePlanSummary; label: string; placeholder: string }> = [
  { key: 'raceType', label: 'Race + target date', placeholder: 'First triathlon on Sept 14' },
  { key: 'experience', label: 'Experience level', placeholder: 'Beginner, little swim history' },
  { key: 'goalTime', label: 'Goal time / outcome', placeholder: 'Finish under 2:45' },
  { key: 'concerns', label: 'Biggest worries', placeholder: 'Open-water anxiety and bike confidence' },
  { key: 'availability', label: 'Availability', placeholder: '6–8 hours/week, long sessions on weekends' },
  { key: 'stravaBaseline', label: 'Baseline notes', placeholder: 'Strava connected, mostly easy runs this month' },
];

const STEPS = [
  'Locking in your race goals and timeline…',
  'Scanning your notes like a seasoned coach…',
  'Cooking up a strong base phase…',
  'Dialing in your build block and key workouts…',
  'Balancing rest, bricks, and long sessions…',
  'Polishing the final weeks for race day…',
  'Still working — longer plans can take 2–4 minutes. Keep this tab open.',
];

/* -------------------------------- UI bits -------------------------------- */

function PillLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
      {children}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 flex items-start justify-between gap-3 sm:gap-4">
      <div className="min-w-0 pr-2">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-xs text-gray-500 break-words">{hint}</div>
        ) : null}
      </div>

      {/* CRITICAL MOBILE FIX:
          - allow this flex child to shrink (min-w-0)
          - on mobile, don't force a hard pixel width (use w-full + max-w)
          - on sm+, use a stable width */}
      <div className="min-w-0 flex-1 max-w-[58%] sm:flex-none sm:w-[260px] sm:max-w-none">
        {children}
      </div>
    </div>
  );
}

function InputBase(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full max-w-full min-w-0 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none',
        'focus:border-gray-300 focus:ring-2 focus:ring-gray-100',
        'placeholder:text-gray-400',
        props.className ?? '',
      ].join(' ')}
    />
  );
}

function SelectBase(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'w-full max-w-full min-w-0 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none',
        'focus:border-gray-300 focus:ring-2 focus:ring-gray-100',
        'appearance-none',
        props.className ?? '',
      ].join(' ')}
    />
  );
}

function TextareaBase(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'w-full max-w-full min-w-0 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none',
        'focus:border-gray-300 focus:ring-2 focus:ring-gray-100',
        'placeholder:text-gray-400',
        props.className ?? '',
      ].join(' ')}
    />
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="inline-flex w-full rounded-full border border-gray-200 bg-white p-1 shadow-sm">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'flex-1 rounded-full px-3 py-2 text-sm font-medium transition',
              active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50',
            ].join(' ')}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NoticeCard({
  tone = 'neutral',
  title,
  desc,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  tone?: 'neutral' | 'danger';
  title: string;
  desc?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const tones =
    tone === 'danger'
      ? {
          wrap: 'border-red-200 bg-red-50',
          title: 'text-red-800',
          desc: 'text-red-700/80',
          secondary: 'border-red-200 hover:bg-red-100/60',
        }
      : {
          wrap: 'border-gray-200 bg-gray-50',
          title: 'text-gray-900',
          desc: 'text-gray-600',
          secondary: 'border-gray-200 hover:bg-gray-50',
        };

  return (
    <div className={`mb-6 rounded-2xl border ${tones.wrap} px-5 py-4`}>
      <div className={`font-medium ${tones.title}`}>{title}</div>
      {desc ? <div className={`mt-1 text-sm ${tones.desc}`}>{desc}</div> : null}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition w-full sm:w-auto"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className={`px-5 py-2.5 rounded-full text-sm font-medium border bg-white transition w-full sm:w-auto ${tones.secondary}`}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- Page -------------------------------- */

function PlanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    raceType: '',
    raceDate: '',
    bikeFTP: '',
    runPace: '',
    swimPace: '',
    experience: '',
    maxHours: '',
    restDay: '',
    paceUnit: 'mi' as 'mi' | 'km',
  });

  const [userNote, setUserNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaSummary, setStravaSummary] = useState<{
    activityCount: number;
    totalHours: number;
    runCount: number;
    bikeCount: number;
    swimCount: number;
    estimatedFtp: number | null;
    estimatedLthr: number | null;
    estimatedRunPace: string | null;
  } | null>(null);
  const [quickMode, setQuickMode] = useState(true);

  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [statusLine, setStatusLine] = useState<string>('Starting…');
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Walkthrough state (still supported for manual open, but we redirect on success)
  const [walkthroughContext, setWalkthroughContext] = useState<WalkthroughContext | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [planReady, setPlanReady] = useState(false);

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceSummary, setVoiceSummary] = useState<VoicePlanSummary>({
    raceType: '',
    raceDate: '',
    experience: '',
    goalTime: '',
    concerns: '',
    availability: '',
    stravaBaseline: '',
  });

  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const runningTypes = useMemo(() => ['5k', '10k', 'Half Marathon', 'Marathon'], []);
  const isRunningPlan = runningTypes.includes(formData.raceType);

  useEffect(() => {
    const raceType = searchParams?.get('raceType');
    const raceDate = searchParams?.get('raceDate');

    if (!raceType && !raceDate) return;

    setFormData((prev) => ({
      ...prev,
      raceType: raceType?.trim() || prev.raceType,
      raceDate: /^\d{4}-\d{2}-\d{2}$/.test(raceDate?.trim() ?? '')
        ? (raceDate as string)
        : prev.raceDate,
    }));
  }, [searchParams]);

  const stravaConnectHref = useMemo(() => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    if (!clientId) return '/settings';

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return '/settings';

    const callback = `${origin}/api/strava/callback`;
    const returnTo = '/plan?source=strava';

    return `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      callback
    )}&scope=activity:read_all,profile:read_all&approval_prompt=auto&state=${encodeURIComponent(returnTo)}`;
  }, []);

  /* -------------------- Clean up polling on unmount -------------------- */
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setVoiceSupported(typeof window !== 'undefined' && !!window.webkitSpeechRecognition);

    return () => {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
    };
  }, []);

  const parseVoiceSummary = (transcript: string): VoicePlanSummary => {
    const sections = transcript
      .split(/\n|\.(?=\s+[A-Z]|\s*$)/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      raceType: sections.find((part) => /triathlon|ironman|70\.3|olympic|sprint|marathon|5k|10k|race/i.test(part)) ?? '',
      raceDate: sections.find((part) => /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[/-]\d{1,2}|\d{4})/i.test(part)) ?? '',
      experience: sections.find((part) => /beginner|intermediate|advanced|first\s+triathlon|first\s+race/i.test(part)) ?? '',
      goalTime: sections.find((part) => /goal|target|time|finish|sub-?\d/i.test(part)) ?? '',
      concerns: sections.find((part) => /worr|concern|injury|swim|bike|run|confidence|anxiety/i.test(part)) ?? '',
      availability: sections.find((part) => /hour|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|schedule|available/i.test(part)) ?? '',
      stravaBaseline: sections.find((part) => /strava|baseline|history|load|recent/i.test(part)) ?? '',
    };
  };

  const stopVoiceCapture = () => {
    speechRecognitionRef.current?.stop();
    setIsListening(false);
  };

  const startVoiceCapture = () => {
    if (!voiceSupported || typeof window === 'undefined') return;

    if (isListening) {
      stopVoiceCapture();
      return;
    }

    const RecognitionCtor = window.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const nextTranscript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();

      setVoiceTranscript(nextTranscript);
      setVoiceSummary(parseVoiceSummary(nextTranscript));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  /* -------------------- Loading Animation -------------------- */
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

  // When user taps "Open Schedule" (during loading or after), use replace + refresh (mobile-safe)
  const handleGoToSchedule = () => {
    router.replace('/schedule');
    router.refresh();
  };

  /* -------------------- Submit Handler -------------------- */
  const handleFinalize = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError('');
    setNotice('');
    setPlanReady(false);
    setWalkthroughOpen(false);
    setWalkthroughContext(null);
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

      const payload = {
        ...formData,
        ...(quickMode
          ? {
              experience: '',
              maxHours: '',
              restDay: '',
            }
          : {}),
      };
      const combinedUserNote = userNote.trim();

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

      const checkSessionsReady = async () => {
        const { count, error: countErr } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countErr) return { ready: false, count: 0 };
        return { ready: (count ?? 0) > 0, count: count ?? 0 };
      };

      const fetchLatestPlanContext = async (): Promise<WalkthroughContext | null> => {
        const { data: latestPlan, error: planErr } = await supabase
          .from('plans')
          .select('id, user_id, race_type, race_date, experience, max_hours, rest_day')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planErr) return null;
        if (!latestPlan?.id || !latestPlan?.user_id) return null;

        return {
          planId: String(latestPlan.id),
          userId: String(latestPlan.user_id),
          raceType: (latestPlan as any).race_type ?? null,
          raceDate: (latestPlan as any).race_date ? String((latestPlan as any).race_date) : null,
          experience: (latestPlan as any).experience ?? null,
          maxHours:
            (latestPlan as any).max_hours != null ? Number((latestPlan as any).max_hours) : null,
          restDay: (latestPlan as any).rest_day ?? null,
        };
      };

      const pollUntilReady = async () => {
        const startedAt = Date.now();

        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        return await new Promise<void>((resolve, reject) => {
          pollTimerRef.current = setInterval(async () => {
            const elapsed = Date.now() - startedAt;

            if (elapsed > 60_000) setProgress((p) => Math.max(p, 85));
            if (elapsed > 120_000) setProgress((p) => Math.max(p, 92));

            const [{ exists: planExists }, sessionsStatus] = await Promise.all([
              checkPlanExists(),
              checkSessionsReady(),
            ]);

            if (planExists && !sessionsStatus.ready) {
              setStatusLine('Plan created — saving workouts to your calendar…');
            } else if (!planExists) {
              setStatusLine('Generating your plan…');
            } else if (sessionsStatus.ready) {
              setStatusLine('Done — your plan is ready.');
            }

            if (sessionsStatus.ready) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;

              setProgress(100);
              setStatusLine('Done — your plan is ready.');
              setLoading(false);
              setPlanReady(true);

              // Fetch plan context (optional planId passthrough)
              let ctx = await fetchLatestPlanContext();
              if (!ctx) {
                await new Promise((r) => setTimeout(r, 500));
                ctx = await fetchLatestPlanContext();
              }

              // Redirect to schedule and auto-open walkthrough there
              const planIdParam = ctx?.planId ? `&planId=${encodeURIComponent(ctx.planId)}` : '';
              router.replace(`/schedule?walkthrough=1${planIdParam}`);
              router.refresh();

              resolve();
              return;
            }

            if (elapsed >= POLL_TIMEOUT_MS) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;

              reject(
                new Error(
                  'Your plan is still generating in the background. This can happen on longer plans. Open Schedule and refresh in a minute.'
                )
              );
            }
          }, POLL_INTERVAL_MS);
        });
      };

      setStatusLine(quickMode ? 'Analyzing your Strava history…' : 'Submitting your inputs…');

      const voiceNote = VOICE_PLAN_FIELDS.map(({ key, label }) => {
        const value = voiceSummary[key].trim();
        return value ? `${label}: ${value}` : null;
      })
        .filter(Boolean)
        .join('\n');

      const mergedUserNote = [userNote.trim(), voiceNote].filter(Boolean).join('\n\n');

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
            ...payload,
            userNote: mergedUserNote,
            planType,
          }),
        });

        resText = await res.text();
        try {
          resJson = JSON.parse(resText);
        } catch {
          resJson = null;
        }
      } catch {
        res = null;
        resJson = null;
      }

      if (res && !res.ok && resJson?.error) {
        throw new Error(resJson.error);
      }

      setStatusLine('Generating your plan…');
      setProgress((prev) => (prev < 20 ? 20 : prev));

      await pollUntilReady();
    } catch (err: any) {
      console.error('❌ Finalize plan error:', err);

      const msg = err?.message || 'Something went wrong while generating your plan. Please try again.';

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

      const sinceISO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

      const [planRes, profileRes, stravaRes] = await Promise.all([
        supabase
          .from('plans')
          .select('id,race_type,race_date,plan')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('strava_access_token')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('strava_activities')
          .select('sport_type,moving_time,start_date,average_heartrate,average_speed,weighted_average_watts,average_watts')
          .eq('user_id', session.user.id)
          .gte('start_date', sinceISO),
      ]);

      if (planRes.data?.id) {
        setHasPlan(true);

        const latestParams = (planRes.data as any).plan?.params ?? null;
        setFormData((prev) => ({
          ...prev,
          raceType: (planRes.data as any).race_type ?? latestParams?.raceType ?? prev.raceType,
          raceDate: (planRes.data as any).race_date ?? latestParams?.raceDate ?? prev.raceDate,
          experience: latestParams?.experience ?? prev.experience,
          maxHours:
            latestParams?.maxHours != null && latestParams?.maxHours !== ''
              ? String(latestParams.maxHours)
              : prev.maxHours,
          restDay: latestParams?.restDay ?? prev.restDay,
          bikeFTP:
            latestParams?.bikeFtp != null && latestParams?.bikeFtp !== ''
              ? String(latestParams.bikeFtp)
              : prev.bikeFTP,
          runPace: latestParams?.runPace ?? prev.runPace,
          swimPace: latestParams?.swimPace ?? prev.swimPace,
        }));
      }

      setStravaConnected(!!profileRes.data?.strava_access_token);

      if (stravaRes.data?.length) {
        const rows = stravaRes.data;
        const totalHours = rows.reduce((acc, row: any) => acc + ((row.moving_time ?? 0) / 3600), 0);
        const runCount = rows.filter((row: any) => String(row.sport_type ?? '').toLowerCase() === 'run').length;
        const bikeCount = rows.filter((row: any) => String(row.sport_type ?? '').toLowerCase() === 'bike').length;
        const swimCount = rows.filter((row: any) => String(row.sport_type ?? '').toLowerCase() === 'swim').length;

        const runCandidates = rows.filter(
          (row: any) =>
            String(row.sport_type ?? '').toLowerCase() === 'run' && (row.moving_time ?? 0) >= 20 * 60
        );
        const bikeCandidates = rows.filter(
          (row: any) =>
            String(row.sport_type ?? '').toLowerCase() === 'bike' && (row.moving_time ?? 0) >= 30 * 60
        );

        const runHrs = runCandidates
          .map((row: any) => row.average_heartrate)
          .filter((v: any) => Number.isFinite(v));
        const estLthr = runHrs.length ? Math.round(Math.max(...runHrs)) : null;

        const bikePowers = bikeCandidates
          .map((row: any) => row.weighted_average_watts ?? row.average_watts)
          .filter((v: any) => Number.isFinite(v) && v > 0);
        const estFtp = bikePowers.length ? Math.round(Math.max(...bikePowers) * 0.95) : null;

        const runSpeeds = runCandidates
          .map((row: any) => row.average_speed)
          .filter((v: any) => Number.isFinite(v) && v > 0);
        const bestRunSpeed = runSpeeds.length ? Math.max(...runSpeeds) : null;
        const estRunPace = bestRunSpeed
          ? `${Math.floor((1000 / bestRunSpeed) / 60)}:${String(
              Math.round((1000 / bestRunSpeed) % 60)
            ).padStart(2, '0')} / km`
          : null;

        setStravaSummary({
          activityCount: rows.length,
          totalHours,
          runCount,
          bikeCount,
          swimCount,
          estimatedFtp: estFtp,
          estimatedLthr: estLthr,
          estimatedRunPace: estRunPace,
        });
      } else {
        setStravaSummary(null);
      }

      setSessionChecked(true);
    };

    checkSessionAndPlan();
  }, []);

  /* -------------------- Field Configs -------------------- */
  const beginnerFields: FieldConfig[] = [
    {
      id: 'raceType',
      label: 'Race',
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
    { id: 'raceDate', label: 'Race date', type: 'date' },
    { id: 'maxHours', label: 'Weekly time', type: 'number' },
    {
      id: 'experience',
      label: 'Experience',
      type: 'select',
      options: ['Beginner', 'Intermediate', 'Advanced'],
    },
  ];

  const advancedFields: FieldConfig[] = isRunningPlan
    ? [
        {
          id: 'runPace',
          label: 'Run threshold pace',
          type: 'text',
          placeholder: formData.paceUnit === 'km' ? 'e.g. 4:40 / km' : 'e.g. 7:30 / mi',
        },
        {
          id: 'restDay',
          label: 'Preferred rest day',
          type: 'select',
          options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
      ]
    : [
        { id: 'bikeFTP', label: 'Bike FTP', type: 'number', placeholder: 'watts' },
        {
          id: 'runPace',
          label: 'Run threshold pace',
          type: 'text',
          placeholder: formData.paceUnit === 'km' ? 'e.g. 4:40 / km' : 'e.g. 7:30 / mi',
        },
        {
          id: 'swimPace',
          label: 'Swim threshold pace',
          type: 'text',
          placeholder: 'e.g. 1:38 / 100m',
        },
        {
          id: 'restDay',
          label: 'Preferred rest day',
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

  const title = hasPlan ? 'Re-generate your plan' : 'Generate your plan';
  const subtitle = quickMode
    ? hasPlan
      ? 'Build a fresh plan from your chosen event + date with Strava-calibrated fitness.'
      : 'Choose your event + race date, sync Strava, and we’ll estimate the rest from recent training.'
    : hasPlan
      ? 'This will replace your current training plan.'
      : 'We’ll personalize your training based on your inputs.';

  const visibleBeginnerFields = quickMode
    ? beginnerFields.filter((field) => field.id === 'raceType' || field.id === 'raceDate')
    : beginnerFields;

  return (
    <div className="min-h-screen bg-white text-gray-900 relative overflow-x-hidden">
      {/* Controlled walkthrough modal (kept for manual open) */}
      <PostPlanWalkthrough
        context={walkthroughContext}
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
      />

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

            {/* ONE CTA ONLY */}
            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={handleGoToSchedule}
                className="text-sm px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
              >
                Open Schedule
              </button>
            </div>

            <p className="text-[12px] text-gray-500 mt-4">
              Tip: very long plans can take a couple minutes — don’t close this tab.
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="py-32 text-center text-gray-400">Loading…</div>}>
        {/* Subtle background wash (matches landing) */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[980px] rounded-full bg-gray-100 blur-3xl opacity-70" />
            <div className="absolute top-24 right-[-160px] h-[360px] w-[360px] rounded-full bg-gray-100 blur-3xl opacity-60" />
            <div className="absolute top-64 left-[-180px] h-[360px] w-[360px] rounded-full bg-gray-100 blur-3xl opacity-60" />
          </div>

          <main className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="text-center mb-10">
              <PillLabel>{hasPlan ? 'Plan management' : 'Plan generator'}</PillLabel>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-3 text-gray-500 text-lg">{subtitle}</p>
            </div>

            {/* Plan Ready (kept; user will usually be redirected) */}
            {planReady && (
              <NoticeCard
                title="Your plan is ready."
                desc="A quick walkthrough is available, then head to your Schedule."
                primaryLabel="Open Schedule"
                onPrimary={handleGoToSchedule}
                secondaryLabel={walkthroughContext ? 'View walkthrough' : undefined}
                onSecondary={() => {
                  if (!walkthroughContext) return;
                  setWalkthroughContext({ ...(walkthroughContext as any), mode: 'manual' });
                  setWalkthroughOpen(true);
                }}
              />
            )}

            {/* Notice (non-blocking) */}
            {notice && (
              <NoticeCard
                title={notice}
                desc="If you just submitted, your plan may have saved successfully. Open Schedule and refresh."
                primaryLabel="Open Schedule"
                onPrimary={handleGoToSchedule}
                secondaryLabel="Dismiss"
                onSecondary={() => setNotice('')}
              />
            )}

            {/* Error (blocking) */}
            {error && (
              <NoticeCard
                tone="danger"
                title={error}
                desc="Try again — and if you just submitted, check Schedule first in case it already saved."
                primaryLabel="Open Schedule"
                onPrimary={handleGoToSchedule}
                secondaryLabel="Dismiss"
                onSecondary={() => setError('')}
              />
            )}

            {/* Generator-style card (matches landing) */}
            <form
              onSubmit={handleFinalize}
              className="w-full max-w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="px-5 sm:px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {hasPlan ? 'Update your inputs' : quickMode ? 'Quick start from Strava' : 'Create your training plan'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {quickMode
                      ? 'Pick an event + race date and connect Strava. We calibrate the plan from your recent training history.'
                      : 'Built around your race and weekly time. Adjust anytime.'}
                  </div>
                </div>

                {hasPlan && !quickMode ? (
                  <button
                    type="button"
                    onClick={() => setQuickMode(true)}
                    className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Use Strava-led quick regenerate
                  </button>
                ) : null}
              </div>

              <div className="px-5 sm:px-6 py-4">
                <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-900">Need help choosing a race?</div>
                  <p className="mt-1 text-xs text-gray-600">
                    Open the race finder page to browse events by location, then bring your pick back here.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/races')}
                    className="mt-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Open race finder
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {visibleBeginnerFields.map(({ id, label, type, options, placeholder }) => {
                    const required = !['bikeFTP', 'runPace', 'swimPace', 'restDay', 'paceUnit'].includes(
                      id
                    );
                    const value = formData[id as keyof typeof formData] as any;

                    const hint =
                      id === 'raceType'
                        ? quickMode
                          ? 'Choose your event (running or triathlon)'
                          : 'Sprint, Olympic, 70.3, Ironman or running events'
                        : id === 'raceDate'
                        ? 'Your goal day'
                        : id === 'maxHours'
                        ? 'Max available training time'
                        : id === 'experience'
                        ? 'How long you’ve trained'
                        : undefined;

                    const raceOptions = quickMode
                      ? ['5k', '10k', 'Half Marathon', 'Marathon', 'Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)']
                      : options;

                    return (
                      <Row key={id} label={label} hint={hint}>
                        {type === 'select' ? (
                          <SelectBase
                            id={id}
                            name={id}
                            value={value}
                            onChange={handleChange}
                            required={required}
                          >
                            <option value="">Select…</option>
                            {raceOptions?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </SelectBase>
                        ) : (
                          <InputBase
                            type={type}
                            id={id}
                            name={id}
                            placeholder={placeholder}
                            value={value}
                            onChange={handleChange}
                            required={required}
                          />
                        )}
                      </Row>
                    );
                  })}
                </div>

                {quickMode ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-900">Strava sync</div>
                    <p className="mt-1 text-xs text-gray-600">
                      Connect Strava and we’ll calibrate {hasPlan ? 'your new plan' : 'your first plan'} from recent training history.
                    </p>

                    {stravaSummary ? (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                        Using last 365 days: {stravaSummary.activityCount} activities • {stravaSummary.totalHours.toFixed(1)}h
                        total • Run {stravaSummary.runCount} • Bike {stravaSummary.bikeCount} • Swim {stravaSummary.swimCount}
                        <br />
                        Baselines: FTP {stravaSummary.estimatedFtp ? `~${stravaSummary.estimatedFtp}w` : 'unknown'} • LTHR{' '}
                        {stravaSummary.estimatedLthr ? `~${stravaSummary.estimatedLthr} bpm` : 'unknown'} • Threshold pace{' '}
                        {stravaSummary.estimatedRunPace ?? 'unknown'}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                        Once connected, we’ll analyze your last 365 days of Strava data and auto-calibrate your plan.
                      </div>
                    )}

                    <div className="mt-3 flex flex-col sm:flex-row gap-3">
                      {stravaConnected ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                          <img src="/strava-2.svg" alt="Strava" className="h-4 w-4" />
                          Strava connected
                        </div>
                      ) : (
                        <a
                          href={stravaConnectHref}
                          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
                        >
                          Connect Strava
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setQuickMode(false)}
                        className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {hasPlan ? 'Regenerate with full inputs' : 'Enter all inputs manually'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {!quickMode ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Voice plan designer (beta)</div>
                        <p className="mt-1 text-xs text-gray-600">
                          Speak your goal, concerns, target time, and baseline. We turn it into editable notes before generating.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startVoiceCapture}
                        disabled={!voiceSupported}
                        className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
                      >
                        {isListening ? 'Stop listening' : 'Start voice capture'}
                      </button>
                    </div>

                    {!voiceSupported ? (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                        Voice capture currently supports Chromium-based browsers.
                      </div>
                    ) : null}

                    {voiceTranscript ? (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                        <span className="font-medium text-gray-900">Transcript:</span> {voiceTranscript}
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {VOICE_PLAN_FIELDS.map(({ key, label, placeholder }) => (
                        <label key={key} className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
                          <InputBase
                            value={voiceSummary[key]}
                            onChange={(e) =>
                              setVoiceSummary((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder={placeholder}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Optional note */}
                {!quickMode ? <div className="mt-4">
                  <div className="text-sm font-medium text-gray-900">
                    Customize your plan (optional)
                  </div>
                  <div className="mt-2">
                    <TextareaBase
                      id="userNote"
                      name="userNote"
                      rows={3}
                      placeholder="E.g. I prefer long rides on Saturdays and long runs on Sundays. I’m targeting sub-5 at Santa Cruz."
                      value={userNote}
                      onChange={(e) => setUserNote(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    The more specific you are, the more “coach-like” the plan will feel.
                  </div>
                </div> : null}

                {/* Advanced toggle */}
                {!quickMode ? <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 overflow-hidden">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Advanced options</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Add thresholds + preferences for a more personalized plan.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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

                  {showAdvanced ? (
                    <div className="mt-3 divide-y divide-gray-200/70">
                      {/* Pace units toggle (running plans only, for now) */}
                      {isRunningPlan ? (
                        <Row label="Pace units" hint="Used for run pacing across your plan">
                          <Segmented
                            value={formData.paceUnit}
                            onChange={(v) =>
                              setFormData((prev) => ({
                                ...prev,
                                paceUnit: v as 'mi' | 'km',
                              }))
                            }
                            options={[
                              { label: 'Miles', value: 'mi' },
                              { label: 'Kilometers', value: 'km' },
                            ]}
                          />
                        </Row>
                      ) : null}

                      {advancedFields.map(({ id, label, type, options, placeholder }) => {
                        const value = formData[id as keyof typeof formData] as any;

                        const hint =
                          id === 'bikeFTP'
                            ? 'Used for bike effort guidance'
                            : id === 'runPace'
                            ? 'Used for run effort guidance'
                            : id === 'swimPace'
                            ? 'Used for swim effort guidance'
                            : id === 'restDay'
                            ? 'We’ll anchor recovery here'
                            : undefined;

                        return (
                          <Row key={id} label={label} hint={hint}>
                            {type === 'select' ? (
                              <SelectBase id={id} name={id} value={value} onChange={handleChange}>
                                <option value="">Select…</option>
                                {options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </SelectBase>
                            ) : (
                              <InputBase
                                type={type}
                                id={id}
                                name={id}
                                placeholder={placeholder}
                                value={value}
                                onChange={handleChange}
                              />
                            )}
                          </Row>
                        );
                      })}
                    </div>
                  ) : null}
                </div> : null}

                {/* Primary submit only */}
                <div className="mt-6 flex flex-col items-center text-center">
                  <button
                    type="submit"
                    disabled={loading || (quickMode && !stravaConnected)}
                    className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-50 w-full sm:w-auto max-w-full"
                  >
                    {loading
                      ? 'Generating…'
                      : hasPlan
                      ? quickMode
                        ? 'Regenerate from Strava'
                        : 'Re-generate plan'
                      : quickMode
                      ? 'Build first plan from Strava'
                      : 'Generate plan'}
                  </button>

                  <div className="mt-3 text-xs text-gray-500">
                    {quickMode
                      ? 'We’ll estimate timeline and weekly volume, then tune as your data accumulates.'
                      : 'Plans usually take 20–60 seconds. Full-distance or far-out races can take longer.'}
                  </div>
                </div>
              </div>
            </form>

            {/* One quiet “back” link only */}
            <div className="mt-6 text-center text-sm text-gray-500">
              Prefer to manage training from your calendar?{' '}
              <button
                type="button"
                onClick={handleGoToSchedule}
                className="underline underline-offset-4 hover:text-gray-900"
              >
                Go to Schedule
              </button>
            </div>
          </main>
        </div>
      </Suspense>

      <Footer />
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PlanPageContent />
    </Suspense>
  );
}
