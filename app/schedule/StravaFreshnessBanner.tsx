'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Freshness = { connected: boolean; syncedAt: string | null };

function ageLabel(value: string | null) {
  if (!value) return 'never';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** Small, honest sync affordance. Do not reintroduce a full-width status banner. */
export default function StravaFreshnessBanner() {
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return;
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('strava_access_token,strava_last_synced_at')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (fetchError) {
      setError('Could not check Strava sync status.');
      return;
    }
    setFreshness({
      connected: Boolean(data?.strava_access_token),
      syncedAt: data?.strava_last_synced_at ?? null,
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Strava sync failed.');
      await refresh();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strava sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const description = error ?? (stale ? 'Last sync is more than 24 hours old.' : `Last sync: ${ageLabel(freshness.syncedAt)}`);
  return (
    <div className="flex min-w-0 items-center gap-2" role={error ? 'alert' : undefined}>
      <button
        type="button"
        onClick={syncNow}
        disabled={syncing}
        title={`${description} Click to sync again.`}
        aria-label={error ? `Strava sync needs attention: ${error}. Retry sync` : `Strava ${stale ? 'sync is stale' : 'synced'}. ${description}. Sync now`}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3 text-xs font-semibold text-[#454B57] transition hover:bg-[#F4F6F8] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141820]"
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-[#C34C4C]' : stale ? 'bg-[#89919E]' : 'bg-[#279568]'}`} />
        <span>{syncing ? 'Syncing…' : error ? 'Strava error · Retry' : stale ? 'Sync Strava' : 'Strava synced'}</span>
      </button>
      {error ? <span className="max-w-48 truncate text-[11px] text-[#B44747]" title={error}>{error}</span> : null}
    </div>
  );
}
