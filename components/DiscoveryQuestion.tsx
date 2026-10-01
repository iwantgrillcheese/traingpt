'use client';
import { useEffect, useState } from 'react';
import { DISCOVERY_OPTIONS, type DiscoverySource } from '@/lib/analytics/attribution';
import { analyticsAllowed, track } from '@/lib/analytics/posthog-client';

export default function DiscoveryQuestion() {
  const [eligible, setEligible] = useState(false);
  const [source, setSource] = useState<DiscoverySource | ''>('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch('/api/acquisition').then(response => response.ok ? response.json() : null)
      .then(result => { if (active) setEligible(Boolean(result?.eligible)); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const skip = () => {
    setEligible(false);
    void fetch('/api/acquisition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_discovery' }) }).catch(() => {});
  };
  const save = async () => {
    if (!source) return;
    setSaving(true); setError(false);
    try {
      const response = await fetch('/api/acquisition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discovery', source, detail, analytics_consent: analyticsAllowed() }) });
      if (!response.ok) throw new Error('Save unavailable');
      const result = await response.json();
      // Detail stays in the account; analytics only receives the selected category.
      if (result.emit_event) track('discovery_reported', { discovery_source: source });
      setEligible(false);
    } catch { setError(true); } finally { setSaving(false); }
  };
  if (!eligible) return null;
  return (
    <section className="mt-4 rounded-[1.5rem] border border-zinc-200 bg-white p-4 sm:p-5" aria-label="Optional discovery question">
      <label htmlFor="discovery-source" className="block text-sm font-semibold text-zinc-950">How did you hear about TrainGPT?</label>
      <p className="mt-1 text-xs text-zinc-500">Optional — you can start training right away.</p>
      <select id="discovery-source" value={source} onChange={event => setSource(event.target.value as DiscoverySource | '')} className="mt-3 w-full rounded-xl border border-zinc-200 bg-[#fbfaf8] px-3 py-2 text-sm text-zinc-800">
        <option value="">Choose an option</option>
        {DISCOVERY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="discovery-detail" className="mt-3 block text-xs text-zinc-500">Anything to add? (optional)</label>
      <input id="discovery-detail" value={detail} onChange={event => setDetail(event.target.value)} maxLength={200} className="mt-1 w-full rounded-xl border border-zinc-200 bg-[#fbfaf8] px-3 py-2 text-sm" />
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={save} disabled={!source || saving} className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save answer'}</button>
        <button type="button" onClick={skip} className="px-2 py-2 text-xs font-semibold text-zinc-500">Skip</button>
      </div>
      {error && <p role="status" className="mt-2 text-xs text-zinc-500">Your answer could not be saved. You can retry or continue training.</p>}
    </section>
  );
}
