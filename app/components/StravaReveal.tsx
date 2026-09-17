'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Activity = { name: string | null; distance: number | null; moving_time: number | null; start_date: string | null; start_date_local: string | null; total_elevation_gain: number | null; };
type Reveal = { activityCount: number; enduranceActivityCount: number; highlights: { longestRide: Activity | null; longestRun: Activity | null; longestSwim: Activity | null; biggestClimb: Activity | null; biggestWeek: { startDate: string; movingTime: number; activityCount: number } | null }; athlete: { hoursBySport: { bike: number; run: number; swim: number }; strongestDiscipline: string | null; activeWeeks: number; spanWeeks: number; consistency: number | null }; language: { historyQualifier: string } };

const miles = (m: number | null) => `${((m ?? 0) / 1609.344).toFixed((m ?? 0) >= 160934 ? 0 : 1)} mi`;
const yards = (m: number | null) => `${Math.round((m ?? 0) * 1.09361).toLocaleString()} yd`;
const feet = (m: number | null) => `${Math.round((m ?? 0) * 3.28084).toLocaleString()} ft`;
const duration = (sec: number | null | undefined) => { const total = Math.round((sec ?? 0) / 60); const h = Math.floor(total / 60); const m = total % 60; return h ? `${h}h ${m}m` : `${m}m`; };
const date = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '';

export default function StravaReveal({ onContinue }: { onContinue: () => void }) {
  const [data, setData] = useState<Reveal | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  useEffect(() => { fetch('/api/strava/reveal', { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error('reveal'); return r.json(); }).then(setData).catch(() => setError('We synced Strava, but could not build your highlights. You can keep going.')); }, []);

  const cards = useMemo(() => data ? [
    data.highlights.longestRide && { eyebrow: 'BIGGEST RIDE', value: miles(data.highlights.longestRide.distance), title: data.highlights.longestRide.name || 'Your longest ride', detail: `${duration(data.highlights.longestRide.moving_time)} · ${date(data.highlights.longestRide.start_date_local || data.highlights.longestRide.start_date)}` },
    data.highlights.longestRun && { eyebrow: 'LONGEST RUN', value: miles(data.highlights.longestRun.distance), title: data.highlights.longestRun.name || 'Your longest run', detail: `${duration(data.highlights.longestRun.moving_time)} · ${date(data.highlights.longestRun.start_date_local || data.highlights.longestRun.start_date)}` },
    data.highlights.longestSwim && { eyebrow: 'LONGEST SWIM', value: yards(data.highlights.longestSwim.distance), title: data.highlights.longestSwim.name || 'Your longest swim', detail: `${duration(data.highlights.longestSwim.moving_time)} · ${date(data.highlights.longestSwim.start_date_local || data.highlights.longestSwim.start_date)}` },
    data.highlights.biggestClimb && { eyebrow: 'BIGGEST CLIMBING DAY', value: feet(data.highlights.biggestClimb.total_elevation_gain), title: data.highlights.biggestClimb.name || 'Your biggest climbing day', detail: date(data.highlights.biggestClimb.start_date_local || data.highlights.biggestClimb.start_date) },
    data.highlights.biggestWeek && { eyebrow: 'BIGGEST TRAINING WEEK', value: duration(data.highlights.biggestWeek.movingTime), title: `${data.highlights.biggestWeek.activityCount} endurance sessions`, detail: `Week of ${date(data.highlights.biggestWeek.startDate)}` },
    { eyebrow: 'BRICK SEES YOU', value: data.athlete.strongestDiscipline ? data.athlete.strongestDiscipline.toUpperCase() : 'ENDURANCE', title: `${data.enduranceActivityCount.toLocaleString()} endurance activities analyzed`, detail: `${data.athlete.activeWeeks} active weeks · ${Math.round((data.athlete.consistency ?? 0) * 100)}% consistency across your imported history` },
  ].filter(Boolean) as Array<{ eyebrow: string; value: string; title: string; detail: string }> : [], [data]);

  if (error) return <div className="rounded-[2rem] border border-[#E3E0D8] bg-[#F7F6F2] p-7"><p className="text-sm text-[#4B5563]">{error}</p><button onClick={onContinue} className="mt-5 rounded-full bg-[#101114] px-5 py-3 text-sm font-bold text-white">Continue</button></div>;
  if (!data) return <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#E3E0D8] border-t-[#FC4C02]"/><h3 className="mt-6 text-2xl font-black tracking-[-0.04em]">Reading your training history…</h3><p className="mt-2 text-sm text-[#6B7280]">Finding the days worth remembering.</p></div>;
  if (!cards.length) return <div className="rounded-[2rem] bg-[#F7F6F2] p-7"><h3 className="text-2xl font-black">Strava is connected.</h3><p className="mt-2 text-sm text-[#6B7280]">We did not find enough swim, bike, or run history for a reveal yet.</p><button onClick={onContinue} className="mt-5 rounded-full bg-[#101114] px-5 py-3 text-sm font-bold text-white">Build my plan</button></div>;

  const card = cards[Math.min(index, cards.length - 1)];
  const last = index >= cards.length - 1;
  return <div className="overflow-hidden rounded-[2rem] bg-[#101114] text-white shadow-[0_28px_90px_rgba(16,17,20,.22)]">
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4"><span className="text-[11px] font-black uppercase tracking-[.22em] text-[#FC4C02]">Your Strava reveal</span><span className="text-xs text-white/45">{index + 1} / {cards.length}</span></div>
    <div className="relative min-h-[390px] p-7 sm:p-10"><AnimatePresence mode="wait"><motion.div key={index} initial={{ opacity: 0, y: 22, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: .32 }} className="flex min-h-[310px] flex-col justify-between">
      <div><p className="text-xs font-black tracking-[.2em] text-white/45">{card.eyebrow}</p><div className="mt-6 text-6xl font-black tracking-[-.08em] sm:text-7xl">{card.value}</div></div>
      <div><h3 className="text-xl font-bold tracking-tight">{card.title}</h3><p className="mt-2 text-sm text-white/55">{card.detail}</p>{last ? <p className="mt-5 max-w-lg text-sm leading-6 text-white/70">This is the athlete profile Brick will use to start calibrating your plan. You can correct anything we cannot know from Strava in the next steps.</p> : null}</div>
    </motion.div></AnimatePresence></div>
    <div className="flex items-center justify-between border-t border-white/10 px-6 py-5"><p className="max-w-[55%] text-[11px] leading-4 text-white/35">Highlights are {data.language.historyQualifier}. We never invent PRs from average activity pace.</p><button onClick={() => last ? onContinue() : setIndex(i => i + 1)} className="rounded-full bg-white px-5 py-3 text-sm font-black text-[#101114] transition hover:scale-[1.02]">{last ? 'Build my plan' : 'Reveal next'}</button></div>
  </div>;
}
