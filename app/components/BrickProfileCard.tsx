'use client';
import { useState } from 'react';
import type { BrickProfile } from '@/lib/strava/athlete-profile';
import { track } from '@/lib/analytics/posthog-client';
const sports = ['bike', 'run', 'swim'] as const;
const colors = { bike: '#FC4C02', run: '#D5E7A3', swim: '#83B9D5' };
export default function BrickProfileCard({ profile, shareable = false }: { profile: BrickProfile; shareable?: boolean }) {
  const [message, setMessage] = useState('');
  const total = Object.values(profile.hoursBySport).reduce((sum, hours) => sum + hours, 0);
  const share = async () => {
    const url = 'https://traingpt.co/login?next=/plan';
    const text = `My Brick profile: ${profile.name}. ${profile.tagline}\n${profile.evidence.join(' · ')}\nBased on my last 8 weeks of imported Strava training.\n\nFind your athlete profile and build a personalized training plan:`;
    try {
      if (navigator.share) await navigator.share({ title: 'My Brick profile', text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setMessage('Profile copied'); }
      track('brick_profile_shared', { archetype: profile.id });
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Sharing unavailable. Try again.'); }
  };
  return <section className="text-white" aria-label="Your Brick athlete profile">
    <p className="text-xs font-black tracking-[.2em] text-[#FC4C02]">YOUR BRICK PROFILE</p>
    <h2 className="mt-5 text-4xl font-black leading-[1.05] tracking-[-.05em] sm:text-5xl">{profile.name}</h2>
    <p className="mt-3 text-lg text-white/80">{profile.tagline}</p>
    <div className="mt-4 flex flex-wrap gap-2">{profile.traits.map(trait => <span key={trait} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">{trait}</span>)}</div>
    <div className="mt-6 grid gap-2 border-t border-white/10 pt-4 text-sm text-white/75">{profile.evidence.map(item => <p key={item}>{item}</p>)}</div>
    {total > 0 ? <div className="mt-5"><div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">{sports.map(sport => <div key={sport} style={{ width: `${profile.hoursBySport[sport] / total * 100}%`, background: colors[sport] }} />)}</div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/60">{sports.map(sport => <span key={sport}>{sport[0].toUpperCase() + sport.slice(1)} {Math.round(profile.hoursBySport[sport] / total * 100)}%</span>)}</div></div> : null}
    <p className="mt-4 text-[11px] leading-5 text-white/40">Based on the last 8 weeks of imported Strava training. This describes your training pattern; it is not a fitness or ability rating.</p>
    {shareable ? <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={share} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#101114]">Share profile</button><span className="text-xs text-white/60" role="status">{message}</span></div> : null}
  </section>;
}
