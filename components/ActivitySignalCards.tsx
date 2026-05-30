'use client';

import { useEffect, useMemo, useState } from 'react';

type SignalProfile = {
  callouts?: Array<{ title?: string; body?: string; tone?: string }>;
  estimates?: Array<{ label?: string; value?: string; confidence?: string; rationale?: string }>;
};

type RevealCard = {
  kicker: string;
  title: string;
  stat: string;
  text: string;
  rating: number;
};

function softenTitle(value?: string) {
  return String(value ?? '')
    .replace(/Big engine:/gi, 'Big ride found')
    .replace(/Run speed signal:/gi, 'Fast run found')
    .replace(/Marathon strength:/gi, 'Marathon flex')
    .replace(/Swim data is thin/gi, 'Swim mystery unlocked')
    .replace(/Run frequency looks light lately/gi, 'Run comeback loading')
    .replace(/Training history connected/gi, 'Training history connected')
    .trim();
}

function extractStat(title: string, body: string) {
  const text = `${title} ${body}`;
  const km = text.match(/\b\d+(?:\.\d+)?\s?km\b/i)?.[0];
  const miles = text.match(/\b\d+(?:\.\d+)?\s?miles?\b/i)?.[0];
  const feet = text.match(/\b\d{1,3}(?:,\d{3})*\s?ft\b/i)?.[0];
  const pace = text.match(/\b\d{1,2}:\d{2}\s?\/\s?(?:mi|100m)\b/i)?.[0];
  const watts = text.match(/\b\d{2,4}W\b/i)?.[0];

  return km ?? miles ?? pace ?? watts ?? feet ?? 'Unlocked';
}

function estimateRating(title: string, body: string) {
  const text = `${title} ${body}`.toLowerCase();
  const bigDistance = text.match(/(\d+(?:\.\d+)?)\s?(?:miles?|km)/i);
  const parsed = bigDistance ? Number(bigDistance[1]) : 0;

  if (text.includes('marathon') || parsed >= 100) return 94;
  if (text.includes('10k') || text.includes('fast')) return 91;
  if (text.includes('ftp') || text.includes('threshold')) return 88;
  if (text.includes('swim')) return 84;
  return 86;
}

function makeBody(title: string, body: string) {
  const combined = `${title} ${body}`.toLowerCase();

  if (combined.includes('ride') && (combined.includes('100') || combined.includes('90') || combined.includes('80') || combined.includes('150'))) {
    return `${body} Someone check if your agent has UAE Team Emirates' number.`;
  }

  if (combined.includes('marathon')) {
    return `${body} That is a serious durability receipt.`;
  }

  if (combined.includes('10k') || combined.includes('fast run')) {
    return `${body} Okay, that is spicy.`;
  }

  if (combined.includes('swim')) {
    return `${body} Classic triathlete plot twist. We will make the early water work friendly.`;
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

    const timer = window.setTimeout(loadSignals, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const cards = useMemo<RevealCard[]>(() => {
    const calloutCards = (profile?.callouts ?? [])
      .filter((item) => item.title && item.body)
      .map((item) => {
        const title = softenTitle(item.title);
        const text = makeBody(title, String(item.body));
        return {
          kicker: item.tone === 'wow' ? 'Rare pull' : 'Coach pull',
          title,
          stat: extractStat(title, text),
          text,
          rating: estimateRating(title, text),
        };
      });

    const estimateCards = (profile?.estimates ?? [])
      .filter((item) => item.label && item.value && !String(item.value).toLowerCase().includes('not enough'))
      .map((item) => {
        const title = String(item.label);
        const text = `Starting point: ${item.value}. Not locked in — you can adjust this before the plan gets built.`;
        return {
          kicker: item.confidence === 'high' ? 'Strong estimate' : 'Training estimate',
          title,
          stat: String(item.value),
          text,
          rating: estimateRating(title, text),
        };
      });

    return [...calloutCards, ...estimateCards].slice(0, 6);
  }, [profile]);

  useEffect(() => {
    if (!cards.length) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % cards.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [cards.length]);

  const fallbackCard: RevealCard = {
    kicker: 'Pack opening',
    title: 'Training history connected',
    stat: 'Live',
    text: 'TrainGPT is opening your activity history and looking for the best stuff.',
    rating: 82,
  };

  const card = cards[index] ?? fallbackCard;

  return (
    <div className="absolute left-1/2 top-[52%] z-10 w-[92%] max-w-[390px] -translate-x-1/2 -translate-y-1/2">
      <div className="absolute -inset-12 rounded-full bg-amber-200/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/45 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-[1px] text-white shadow-[0_34px_100px_rgba(0,0,0,0.62)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(252,211,77,0.35),transparent_40%),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.18),transparent_34%)]" />
        <div className="absolute -left-1/2 top-0 h-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: 'shine 3.6s ease-in-out infinite' }} />
        <div className="relative rounded-[1.92rem] border border-white/10 bg-black/35 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/70">{card.kicker}</div>
              <div className="mt-2 text-xl font-semibold leading-6 tracking-[-0.03em]">{card.title}</div>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-amber-200/35 bg-amber-200/15 text-3xl font-black tracking-[-0.08em] text-amber-100 shadow-inner">
              {card.rating}
            </div>
          </div>

          <div className="mt-6 rounded-[1.35rem] border border-white/10 bg-white/10 px-5 py-4 text-center shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Best stat</div>
            <div className="mt-1 text-4xl font-black tracking-[-0.09em] text-white sm:text-5xl">{card.stat}</div>
          </div>

          <p className="mt-5 text-sm leading-6 text-white/76">{card.text}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/58">
            <div className="rounded-xl bg-white/8 px-2 py-2.5">Endurance</div>
            <div className="rounded-xl bg-white/8 px-2 py-2.5">Grit</div>
            <div className="rounded-xl bg-white/8 px-2 py-2.5">Form</div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-140%) rotate(12deg); opacity: 0; }
          30% { opacity: 1; }
          62% { transform: translateX(360%) rotate(12deg); opacity: 0.75; }
          100% { transform: translateX(360%) rotate(12deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
