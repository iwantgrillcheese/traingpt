'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function PlanBuilderTrustPanel() {
  const [raceName, setRaceName] = useState('');
  const [hasPlan, setHasPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) return;
      const [{ data: profile }, { data: plan }] = await Promise.all([
        supabase.from('profiles').select('race_name').eq('id', auth.user.id).maybeSingle(),
        supabase.from('plans').select('id').eq('user_id', auth.user.id).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setRaceName(String((profile as any)?.race_name ?? ''));
      setHasPlan(Boolean((plan as any)?.id));
    })();
    return () => { active = false; };
  }, []);

  const saveRaceName = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from('profiles').update({ race_name: raceName.trim() || null }).eq('id', auth.user.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-[#E3E0D8] bg-white p-4">
          <label className="text-sm font-black text-[#101114]" htmlFor="race-name">Race name <span className="font-medium text-[#9CA3AF]">optional</span></label>
          <p className="mt-1 text-xs leading-5 text-[#6B7280]">Give the build a real name, like Santa Cruz 70.3. It stays attached when the plan is rebuilt.</p>
          <div className="mt-3 flex gap-2">
            <input id="race-name" value={raceName} onChange={(event) => setRaceName(event.target.value)} placeholder="e.g. Santa Cruz 70.3" className="min-w-0 flex-1 rounded-xl border border-[#E3E0D8] px-3 py-2.5 text-sm outline-none focus:border-[#101114]" />
            <button type="button" onClick={saveRaceName} disabled={saving} className="rounded-xl bg-[#101114] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : saved ? 'Saved' : 'Save'}</button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E3E0D8] bg-[#F7F6F2] p-4">
          <p className="text-sm font-black text-[#101114]">What happens when you generate</p>
          <p className="mt-1 text-xs leading-5 text-[#6B7280]">Triathlon plans use the fast scaffold path and should appear quickly; longer running plans can take a couple of minutes. Keep the tab open until the plan is saved.</p>
          {hasPlan ? (
            <p className="mt-2 text-xs leading-5 text-[#6B7280]">Rebuilding archives your current race build and starts a fresh readiness score. Your old score and sessions remain visible in <Link href="/settings/history" className="font-black underline underline-offset-2">Plan history</Link>.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
