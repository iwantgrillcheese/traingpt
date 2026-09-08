'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Freshness = {
  connected: boolean;
  syncedAt: string | null;
};

function ageLabel(value: string | null) {
  if (!value) return 'never';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StravaFreshnessBanner() {
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('strava_access_token,strava_last_synced_at')
      .eq('id', auth.user.id)
      .maybeSingle();

    setFreshness({
      connected: Boolean((data as any)?.strava_access_token),
      syncedAt: (data as any)?.strava_last_synced_at ?? null,
    });
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setTimeout(() => void refresh(), 3500);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const stale = useMemo(() => {
    if (!freshness?.connected) return false;
    if (!freshness.syncedAt) return true;
    return Date.now() - new Date(freshness.syncedAt).getTime() > 24 * 60 * 60 * 1000;
  }, [freshness]);

  if (!freshness?.connected) return null;

  const syncNow = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await fetch('/api/strava_sync', { method: 'POST' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'Strava sync failed.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strava sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="px-5 pt-4 lg:px-8">
      <div
        className={`mx-auto flex max-w-[1500px] flex-col gap-2 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
          stale || error
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-[#E3E0D8] bg-white text-[#4B5563]'
        }`}
      >
        <div>
          <span className="font-black">Strava {error ? 'needs attention' : stale ? 'is stale' : 'synced'}</span>
          <span className="ml-2">Last successful sync: {ageLabel(freshness.syncedAt)}.</span>
          {error ? <span className="ml-2">{error}</span> : null}
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="w-fit rounded-full border border-current/20 bg-white px-3 py-1.5 text-xs font-black disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
    </div>
  );
}
