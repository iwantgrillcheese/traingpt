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
  authReady?: boolean;
  isAuthenticated?: boolean;
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

function getSyncSuccessMessage(result: StravaSyncResult) {
  const inserted = Number(result?.inserted ?? 0);
  const totalFetched = Number(result?.totalFetched ?? 0);

  if (inserted > 0) {
    return `Imported ${inserted} new Strava ${inserted === 1 ? 'activity' : 'activities'}.`;
  }

  if (totalFetched > 0) {
    return 'Strava is already up to date.';
  }

  return 'No new Strava activities found.';
}

export function useStravaAutoSync(options: UseStravaAutoSyncOptions = {}) {
  const {
    enabled = true,
    authReady = true,
    isAuthenticated = true,
    onSyncComplete,
  } = options;

  const hasAutoSyncedRef = useRef(false);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StravaSyncResult | null>(null);

  const syncNow = useCallback(async () => {
    if (!enabled || !authReady) return null;

    if (!isAuthenticated) {
      const result = {
        error: 'Strava is connected, but your TrainGPT session is not ready. Refresh and try syncing again.',
      };

      setStatus('error');
      setMessage(result.error);
      setLastResult(result);
      return result;
    }

    setStatus('syncing');
    setMessage('Importing your latest Strava activities…');

    try {
      const res = await fetch('/api/strava_sync', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as StravaSyncResult;

      if (!res.ok) {
        const errorMessage =
          res.status === 401
            ? 'Strava connected, but your TrainGPT session was not ready to sync. Refresh and try Sync latest.'
            : json?.error || 'Strava sync failed.';

        const result = { ...json, error: errorMessage };
        setStatus('error');
        setMessage(errorMessage);
        setLastResult(result);
        return result;
      }

      setStatus('success');
      setMessage(getSyncSuccessMessage(json));
      setLastResult(json);
      onSyncComplete?.(json);

      return json;
    } catch (error) {
      console.error('[useStravaAutoSync] sync failed:', error);
      const result = { error: 'Unexpected Strava sync error. Try again.' };
      setStatus('error');
      setMessage(result.error);
      setLastResult(result);
      return result;
    }
  }, [authReady, enabled, isAuthenticated, onSyncComplete]);

  useEffect(() => {
    if (!enabled || !authReady || !isAuthenticated || hasAutoSyncedRef.current) return;

    const url = new URL(window.location.href);
    if (!shouldAutoSyncFromUrl(url)) return;

    hasAutoSyncedRef.current = true;

    syncNow().finally(() => {
      cleanStravaSyncParams();
    });
  }, [authReady, enabled, isAuthenticated, syncNow]);

  return {
    status,
    message,
    lastResult,
    syncNow,
    isSyncing: status === 'syncing',
  };
}
