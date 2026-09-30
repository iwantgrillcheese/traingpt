'use client';
import { useEffect, useState } from 'react';
import { routeGeometry } from '@/lib/strava/route-geometry';
export default function ActivityRoute({ activityId }: { activityId: number }) {
  const [result, setResult] = useState<{ polyline?: string | null; error?: string; reason?: string; deviceName?: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    fetch(`/api/strava/activity-route?id=${activityId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Route unavailable'); return value; })
      .then(setResult).catch(error => { if (!controller.signal.aborted) setResult({ error: error.message }); });
    return () => controller.abort();
  }, [activityId, attempt]);
  const geometry = result?.polyline ? routeGeometry(result.polyline) : null;
  if (!geometry) return <div className="mt-5 flex min-h-20 items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-xs text-white/50" role="status"><span>{!result ? 'Loading your route…' : result.error || result.reason || 'No GPS route available'}</span>{result?.error ? <button className="shrink-0 text-white underline" onClick={() => setAttempt(value => value + 1)}>Retry route</button> : null}</div>;
  return <figure className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#171a1e]">
    <svg viewBox="0 0 600 280" className="h-40 w-full sm:h-48" role="img" aria-label="GPS route from this Strava activity">
      <path d="M0 70H600 M0 140H600 M0 210H600 M100 0V280 M200 0V280 M300 0V280 M400 0V280 M500 0V280" stroke="white" strokeOpacity=".04" fill="none" />
      <path d={geometry.path} stroke="#FC4C02" strokeWidth="10" strokeOpacity=".12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={geometry.path} stroke="#FC4C02" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={geometry.start[0]} cy={geometry.start[1]} r="4" fill="white" stroke="#171a1e" strokeWidth="2" />
      <circle cx={geometry.end[0]} cy={geometry.end[1]} r="4" fill="#FC4C02" stroke="white" strokeWidth="1.5" />
    </svg>
    <figcaption className="flex flex-wrap justify-between gap-2 px-4 pb-3 text-[10px] text-white/45"><span>GPS route · {result?.deviceName ? `${result.deviceName} via Strava` : 'Powered by Strava'}</span><a href={`https://www.strava.com/activities/${activityId}`} target="_blank" rel="noopener noreferrer" className="text-white/70 underline">View on Strava</a></figcaption>
  </figure>;
}
