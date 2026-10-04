'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { routeGeometry } from '@/lib/strava/route-geometry';

type Props = {
  activityId: number;
  variant?: 'dark' | 'light';
  compact?: boolean;
};

export default function ActivityRoute({ activityId, variant = 'dark', compact = false }: Props) {
  const [result, setResult] = useState<{ polyline?: string | null; error?: string; reason?: string; deviceName?: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    fetch(`/api/strava/activity-route?id=${activityId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Route unavailable');
        return value;
      })
      .then(setResult)
      .catch(error => {
        if (!controller.signal.aborted) setResult({ error: error.message });
      });
    return () => controller.abort();
  }, [activityId, attempt]);

  const geometry = result?.polyline ? routeGeometry(result.polyline) : null;
  const light = variant === 'light';

  if (!geometry) {
    return (
      <div
        className={clsx(
          compact ? 'mt-3' : 'mt-5',
          'flex min-h-20 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs',
          light ? 'border-zinc-200 bg-zinc-50 text-zinc-500' : 'border-white/10 text-white/50',
        )}
        role="status"
      >
        <span>{!result ? 'Loading your route…' : result.error || result.reason || 'No GPS route available'}</span>
        {result?.error ? (
          <button
            className={clsx('shrink-0 underline', light ? 'text-zinc-700' : 'text-white')}
            onClick={() => setAttempt(value => value + 1)}
          >
            Retry route
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <figure
      className={clsx(
        compact ? 'mt-3' : 'mt-5',
        'overflow-hidden rounded-2xl border',
        light ? 'border-zinc-200 bg-[#F7F7FB]' : 'border-white/10 bg-[#171a1e]',
      )}
    >
      <svg
        viewBox="0 0 600 280"
        className={clsx(compact ? 'h-36' : 'h-40 sm:h-48', 'w-full')}
        role="img"
        aria-label="GPS route from this Strava activity"
      >
        <rect width="600" height="280" fill={light ? '#F7F7FB' : '#171a1e'} />
        <path
          d="M0 70H600 M0 140H600 M0 210H600 M100 0V280 M200 0V280 M300 0V280 M400 0V280 M500 0V280"
          stroke={light ? '#111827' : 'white'}
          strokeOpacity={light ? '.055' : '.04'}
          fill="none"
        />
        <path
          d={geometry.path}
          stroke="#FC4C02"
          strokeWidth="10"
          strokeOpacity={light ? '.10' : '.12'}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={geometry.path} stroke="#FC4C02" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={geometry.start[0]} cy={geometry.start[1]} r="4" fill={light ? '#16A34A' : 'white'} stroke={light ? 'white' : '#171a1e'} strokeWidth="2" />
        <circle cx={geometry.end[0]} cy={geometry.end[1]} r="4" fill="#FC4C02" stroke="white" strokeWidth="1.5" />
      </svg>
      <figcaption
        className={clsx(
          'flex flex-wrap justify-between gap-2 px-4 pb-3 text-[10px]',
          light ? 'text-zinc-400' : 'text-white/45',
        )}
      >
        <span>GPS route · {result?.deviceName ? `${result.deviceName} via Strava` : 'Powered by Strava'}</span>
        <a
          href={`https://www.strava.com/activities/${activityId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx('underline', light ? 'text-zinc-600' : 'text-white/70')}
        >
          View on Strava
        </a>
      </figcaption>
    </figure>
  );
}
