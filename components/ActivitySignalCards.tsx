'use client';

import { useEffect, useMemo, useState } from 'react';

type SignalProfile = {
  callouts?: Array<{ title?: string; body?: string; tone?: string }>;
  estimates?: Array<{ label?: string; value?: string; confidence?: string; rationale?: string }>;
};

export default function ActivitySignalCards() {
  const [profile, setProfile] = useState<SignalProfile | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function loadSignals() {
      attempt += 1;
      try {
        const response = await fetch('/api/strava/training-profile', { cache: 'no-store' });
        if (!response.ok) throw new Error('signals unavailable');
        const json = (await response.json()) as SignalProfile;
        if (!cancelled) setProfile(json);
      } catch {
        if (!cancelled && attempt < 4) window.setTimeout(loadSignals, 1800);
      }
    }

    const timer = window.setTimeout(loadSignals, 1600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const cards = useMemo(() => {
    const calloutCards = (profile?.callouts ?? [])
      .filter((item) => item.title && item.body)
      .map((item) => ({
        kicker: item.tone === 'wow' ? 'Standout' : item.tone === 'caution' ? 'Coach note' : 'Signal found',
        title: String(item.title),
        text: String(item.body),
      }));

    const estimateCards = (profile?.estimates ?? [])
      .filter((item) => item.label && item.value && !String(item.value).toLowerCase().includes('not enough'))
      .map((item) => ({
        kicker: item.confidence === 'high' ? 'Strong estimate' : item.confidence === 'medium' ? 'Working estimate' : 'Early estimate',
        title: String(item.label),
        text: `${item.value} — ${item.rationale ?? 'Review this before generating your plan.'}`,
      }));

    return [...calloutCards, ...estimateCards].slice(0, 6);
  }, [profile]);

  useEffect(() => {
    if (!cards.length) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % cards.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [cards.length]);

  if (!cards.length) return null;

  const card = cards[index];

  return (
    <div className="absolute -left-4 bottom-4 max-w-[270px] rounded-2xl border border-white/10 bg-white/10 p-3 text-white shadow-2xl backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{card.kicker}</div>
      <div className="mt-1 text-sm font-semibold leading-5">{card.title}</div>
      <div className="mt-1 line-clamp-3 text-xs leading-5 text-white/70">{card.text}</div>
    </div>
  );
}
