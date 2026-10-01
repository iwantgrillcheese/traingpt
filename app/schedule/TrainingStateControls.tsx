"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { track } from '@/lib/analytics/posthog-client';
import type { TrainingPause, PauseReason } from '@/utils/trainingPause';

export default function TrainingStateControls({ planId, onChanged }: { planId: string; onChanged: () => void }) {
  const [pause, setPause] = useState<TrainingPause | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState<PauseReason>('life');
  const [returnDate, setReturnDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from('training_pauses').select('*').eq('plan_id', planId).eq('status', 'paused').maybeSingle().then(({ data, error }: { data: TrainingPause | null; error: unknown }) => {
      if (!cancelled) { setPause(data as TrainingPause | null); if (error) setError('Could not load training state.'); }
    });
    return () => { cancelled = true; };
  }, [planId]);
  const update = async (action: 'pause' | 'resume', mode?: 'normal' | 'ease') => {
    setBusy(true); setError(null);
    try {
      const date = new Date();
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const response = await fetch('/api/training-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, action, mode, reason, date: localDate, expected_return_date: returnDate || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      track(action === 'pause' ? 'training_paused' : 'training_resumed', { plan_id: planId, resume_mode: mode });
      onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update training state.'); }
    finally { setBusy(false); }
  };
  const button = 'rounded-full border border-[#E3E0D8] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
  return <section className="relative">
    {pause ? <><p className="mb-2 text-sm font-semibold">Training paused · {pause.reason === 'life' ? 'Life / unavailable' : pause.reason} since {pause.started_date}</p>
      <p className="mb-3 text-sm text-[#6B7280]">Paused sessions do not count as missed. Your training history is preserved.{pause.expected_return_date ? ` Expected return: ${pause.expected_return_date}.` : ''}</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => update('resume', 'normal')}>Resume normally</button><button className={button} disabled={busy} onClick={() => update('resume', 'ease')}>Ease me back in</button></div>
    </> : <><button className={button} onClick={() => setExpanded(!expanded)}>Pause training</button>
      {expanded ? <div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm">Reason<select className="ml-2 rounded border p-2" value={reason} onChange={e => setReason(e.target.value as PauseReason)}><option value="sick">Sick</option><option value="injured">Injured</option><option value="travel">Travel</option><option value="life">Life / unavailable</option></select></label>
      <label className="text-sm">Expected return (optional)<input className="ml-2 rounded border p-2" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} /></label><button className={button} disabled={busy} onClick={() => update('pause')}>Pause training</button></div> : null}</>}
    {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
  </section>;
}
