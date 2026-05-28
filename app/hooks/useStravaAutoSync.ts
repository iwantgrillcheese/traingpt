'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type StravaSyncResult = {
  inserted?: number;
  totalFetched?: number;
  skippedExisting?: number;
  error?: string;
};

type UseStravaAutoSyncOptions = {
  enabled?: boolean;
  onSyncComplete?: (result: StravaSyncResult) => void;
};

function shouldAutoSyncFromUrl(url: URL) {
  return url.searchParams.get('success') === 'strava_connected' || url.searchParams.get('sync') === 'needed';
}

function cleanStravaSyncParams() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete('success');
  nextUrl.searchParams.delete('sync');
  window.history.replaceState({}, '', nextUrl.toString());
}

export function useStravaAutoSync(options: UseStravaAutoSyncOptions = {}) {
  const { enabled = true, onSyncComplete } = options;

  const hasAutoSyncedRef = useRef(false);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StravaSyncResult | null>(null);

  const syncNow = useCallback(async () => {
    if (!enabled) return null;

    setStatus('syncing');
    setMessage('Importing your latest Strava activities…');

    try {
      const res = await fetch('/api/strava_sync', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as StravaSyncResult;

      if (!res.ok) {
        const errorMessage = json?.error || 'Strava sync failed.';
        setStatus('error');
        setMessage(errorMessage);
        setLastResult(json);
        return json;
      }

      const inserted = Number(json?.inserted ?? 0);
      const totalFetched = Number(json?.totalFetched ?? 0);

      setStatus('success');
      setMessage(
        inserted > 0
          ? `Imported ${inserted} new Strava ${inserted === 1 ? 'activity' : 'activities'}.`
          : totalFetched > 0
            ? 'Strava is already up to date.'
            : 'No new Strava activities found.'
      );
      setLastResult(json);
      onSyncComplete?.(json);

      return json;
    } catch (error) {
      console.error('[useStravaAutoSync] sync failed:', error);
      const json = { error: 'Unexpected Strava sync error.' };
      setStatus('error');
      setMessage(json.error);
      setLastResult(json);
      return json;
    }
  }, [enabled, onSyncComplete]);

  useEffect(() => {
    if (!enabled || hasAutoSyncedRef.current) return;

    const url = new URL(window.location.href);
    if (!shouldAutoSyncFromUrl(url)) return;

    hasAutoSyncedRef.current = true;

    syncNow().finally(() => {
      cleanStravaSyncParams();
    });
  }, [enabled, syncNow]);

  return {
    status,
    message,
    lastResult,
    syncNow,
    isSyncing: status === 'syncing',
  };
}
