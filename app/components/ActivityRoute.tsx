'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { routeGeometry } from '@/lib/strava/route-geometry';

// Keep Leaflet out of the calendar and out of the server-rendered JS bundle.
const ActivityStreetMap = dynamic(() => import('./ActivityStreetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#F1F3F1] text-xs text-zinc-500">
      Preparing street map…
    </div>
  ),
});

type Props = {
  activityId: number;
  variant?: 'dark' | 'light';
  compact?: boolean;
};

type RouteResponse = {
  polyline?: string | null;
  error?: string;
  reason?: string;
  deviceName?: string | null;
};

export default function ActivityRoute({ activityId, variant = 'dark', compact = false }: Props) {
  const [result, setResult] = useState<{ key: string; value: RouteResponse } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [mapUnavailableKey, setMapUnavailableKey] = useState<string | null>(null);
  const routeKey = activityId + ':' + attempt;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/strava/activity-route?id=' + activityId, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const value: RouteResponse = await response.json();
        if (!response.ok) throw new Error(value.error || 'Route unavailable');
        return value;
      })
      .then(value => {
        if (!controller.signal.aborted) setResult({ key: routeKey, value });
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setResult({ key: routeKey, value: { error: error instanceof Error ? error.message : 'Route unavailable' } });
        }
      });

    return () => controller.abort();
  }, [activityId, routeKey]);

  const onMapUnavailable = useCallback(() => {
    setMapUnavailableKey(routeKey);
  }, [routeKey]);

  const current = result?.key === routeKey ? result.value : null;
  const geometry = current?.polyline ? routeGeometry(current.polyline) : null;
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
        <span>{!current ? 'Loading your route…' : current.error || current.reason || 'No GPS route available'}</span>
        {current?.error ? (
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

  const showFallback = mapUnavailableKey === routeKey;

  return (
    <figure
      className={clsx(
        compact ? 'mt-3' : 'mt-5',
        'overflow-hidden rounded-2xl border',
        light ? 'border-zinc-200 bg-[#F7F7FB]' : 'border-white/10 bg-[#171a1e]',
      )}
    >
      {showFallback ? (
        <svg
          viewBox="0 0 600 280"
          className={clsx(compact ? 'h-36' : 'h-40 sm:h-48', 'w-full')}
          role="img"
          aria-label="GPS route from this Strava activity, without street-map tiles"
        >
          <rect width="600" height="280" fill={light ? '#F7F7FB' : '#171a1e'} />
          <path
            d="M0 70H600 M0 140H600 M0 210H600 M100 0V280 M200 0V280 M300 0V280 M400 0V280 M500 0V280"
            stroke={light ? '#111827' : 'white'}
            strokeOpacity={light ? '.055' : '.04'}
            fill="none"
          />
          <path d={geometry.path} stroke="#FC4C02" strokeWidth="10" strokeOpacity=".12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={geometry.path} stroke="#FC4C02" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={geometry.start[0]} cy={geometry.start[1]} r="4" fill={light ? '#16A34A' : 'white'} stroke={light ? 'white' : '#171a1e'} strokeWidth="2" />
          <circle cx={geometry.end[0]} cy={geometry.end[1]} r="4" fill="#FC4C02" stroke="white" strokeWidth="1.5" />
        </svg>
      ) : (
        <div className={clsx(compact ? 'h-48 sm:h-56' : 'h-56 sm:h-64', 'w-full')}>
          <ActivityStreetMap key={routeKey} polyline={current?.polyline || ''} onUnavailable={onMapUnavailable} />
        </div>
      )}

      <figcaption
        className={clsx(
          'flex flex-wrap justify-between gap-2 px-4 py-2.5 text-[10px]',
          light ? 'bg-white text-zinc-500' : 'bg-[#171a1e] text-white/55',
        )}
      >
        <span>GPS route · {current?.deviceName ? current.deviceName + ' via Strava' : 'Powered by Strava'}</span>
        <a
          href={'https://www.strava.com/activities/' + activityId}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx('underline underline-offset-2', light ? 'text-zinc-700' : 'text-white/70')}
        >
          View on Strava
        </a>
      </figcaption>
    </figure>
  );
}
