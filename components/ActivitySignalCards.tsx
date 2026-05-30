'use client';

import { useEffect, useMemo, useState } from 'react';

type SignalProfile = {
  callouts?: Array<{ title?: string; body?: string; tone?: string }>;
  estimates?: Array<{ label?: string; value?: string; confidence?: string; rationale?: string }>;
};

function softenTitle(value?: string) {
  return String(value ?? '')
    .replace(/Big engine:/gi, 'Big day found:')
    .replace(/Run speed signal:/gi, 'Fast run found:')
    .replace(/Marathon strength:/gi, 'Marathon flex:')
    .replace(/Swim data is thin/gi, 'Swim mystery unlocked')
    .replace(/Run frequency looks light lately/gi, 'Run comeback loading')
    .replace(/Training history connected/gi, 'Training history connected')
    .trim();
}

function makeBody(title: string, body: string) {
  const combined = `${title} ${body}`.toLowerCase();

  if (combined.includes('ride') && (combined.includes('100') || combined.includes('90') || combined.includes('80'))) {
    return `${body} WorldTour team on line one.`;
  }

  if (combined.includes('marathon')) {
    return `${body} That is a serious durability receipt.`;
  }

  if (combined.includes('10k') || combined.includes('run speed')) {
    return `${body} Okay, that is spicy.`;
  }

  if (combined.includes('swim')) {
    return `${body} Very on-brand for triathlon. We will keep it friendly to start.`;
  }

  return body;
}

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
        if (!response.ok) throw new Error('activity highlights unavailable');
        const json = (await response.json()) as SignalProfile;
        if (!cancelled) setProfile(json);
      } catch {
        if (!cancelled && attempt < 4) window.setTimeout(loadSignals, 1800);
      }
    }

    const timer = window.setTimeout(loadSignals, 1400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const cards = useMemo(() => {
    const calloutCards = (profile?.callouts ?? [])
      .filter((item) => item.title && item.body)
      .map((item) => {
        const title = softenTitle(item.title);
        const body = makeBody(title, String(item.body));
        return {
          kicker: item.tone === 'wow' ? 'Nice find' : 'Coach noticed',
          title,
          text: body,
        };
      });

    const estimateCards = (profile?.estimates ?? [])
      .filter((item) => item.label && item.value && !String(item.value).toLowerCase().includes('not enough'))
      .map((item) => ({
        kicker: 'Starting estimate',
        title: String(item.label),
        text: `${item.value} — Not locked in. You can adjust this before the plan gets built.`,
      }));

    return [...calloutCards, ...estimateCards].slice(0, 6);
  }, [profile]);

  useEffect(() => {
    if (!cards.length) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % cards.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [cards.length]);

  const fallbackCard = {
    kicker: 'Training history found',
    title: 'Your activities are connected',
    text: 'TrainGPT is looking for the best stuff in your history so your plan starts with real context.',
  };

  const card = cards[index] ?? fallbackCard;

  return (
    <div className="absolute left-1/2 top-[58%] z-10 w-[82%] max-w-[315px] -translate-x-1/2 rounded-[1.35rem] border border-white/15 bg-white/12 p-4 text-white shadow-2xl backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{card.kicker}</div>
      <div className="mt-2 text-base font-semibold leading-5">{card.title}</div>
      <div className="mt-2 text-xs leading-5 text-white/72">{card.text}</div>
    </div>
  );
}
