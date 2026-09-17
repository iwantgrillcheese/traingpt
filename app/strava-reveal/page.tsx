'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StravaReveal from '@/app/components/StravaReveal';
import { track } from '@/lib/analytics/posthog-client';

export default function StravaRevealPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    track('strava_reveal_started');
    fetch('/api/strava_sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forceBackfill: true }) })
      .then(async (res) => { if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Sync failed'); return res.json(); })
      .then((result) => { if (!active) return; track('strava_history_imported', { activities_fetched: result.totalFetched, history_complete: result.historyComplete }); setReady(true); })
      .catch((err) => { if (!active) return; console.error('[strava-reveal] full import failed', err); setError('We connected Strava, but the history import did not finish. You can retry without reconnecting.'); });
    return () => { active = false; };
  }, []);

  const continueToPlan = () => { track('strava_reveal_completed'); router.replace('/plan?source=strava&step=goal'); };
  if (error) return <main className="min-h-screen bg-[#F7F6F2] px-5 py-16"><div className="mx-auto max-w-xl rounded-[2rem] border border-[#E3E0D8] bg-white p-8"><p className="text-xs font-black uppercase tracking-[.2em] text-[#FC4C02]">Strava connected</p><h1 className="mt-4 text-3xl font-black tracking-[-.05em]">Your history needs another pass.</h1><p className="mt-3 text-sm leading-6 text-[#6B7280]">{error}</p><button onClick={() => location.reload()} className="mt-6 rounded-full bg-[#101114] px-5 py-3 text-sm font-black text-white">Retry import</button><button onClick={continueToPlan} className="ml-3 mt-6 px-4 py-3 text-sm font-bold text-[#6B7280]">Skip</button></div></main>;
  if (!ready) return <main className="flex min-h-screen items-center justify-center bg-[#101114] px-5 text-white"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#FC4C02]"/><p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-[#FC4C02]">Strava connected</p><h1 className="mt-3 text-3xl font-black tracking-[-.05em]">Opening your training history…</h1><p className="mt-3 text-sm text-white/50">We’re importing the real history before we show you anything.</p></div></main>;
  return <main className="min-h-screen bg-[#F7F6F2] px-4 py-8 sm:px-6 sm:py-14"><div className="mx-auto max-w-3xl"><StravaReveal onContinue={continueToPlan}/></div></main>;
}
