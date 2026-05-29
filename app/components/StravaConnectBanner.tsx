'use client';

import { useEffect, useMemo, useState } from 'react';
import { track } from '@/lib/analytics/posthog-client';

type Props = {
  stravaConnected: boolean;
  onSyncComplete?: () => void;
};

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

type SyncResponse = {
  inserted?: number;
  totalFetched?: number;
  skippedExisting?: number;
  error?: string;
};

function getSafeReturnTo() {
  if (typeof window === 'undefined') return '/coaching';

  const path = `${window.location.pathname}${window.location.search}`;
  return path.startsWith('/') && !path.startsWith('//') ? path : '/coaching';
}

function buildStravaConnectUrl() {
  if (typeof window === 'undefined') return '#';

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '145662';
  const redirectUri = `${window.location.origin}/api/strava/callback`;
  const returnTo = getSafeReturnTo();

  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'activity:read_all,profile:read_all');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('state', returnTo);

  return url.toString();
}

function getSyncMessage(state: SyncState, response: SyncResponse | null) {
  if (state === 'syncing') return 'Syncing latest activities…';
  if (state === 'error') return response?.error || 'Sync failed. Try again.';
  if (state !== 'success') return null;

  const inserted = Number(response?.inserted ?? 0);
  const totalFetched = Number(response?.totalFetched ?? 0);

  if (inserted > 0) return `Imported ${inserted} new ${inserted === 1 ? 'activity' : 'activities'}.`;
  if (totalFetched > 0) return 'Already up to date.';
  return 'No new activities found.';
}

export default function StravaConnectBanner({ stravaConnected, onSyncComplete }: Props) {
  const [connectUrl, setConnectUrl] = useState('#');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncResponse, setSyncResponse] = useState<SyncResponse | null>(null);

  useEffect(() => {
    setConnectUrl(buildStravaConnectUrl());
  }, []);

  const syncMessage = useMemo(() => getSyncMessage(syncState, syncResponse), [syncState, syncResponse]);

  const handleSync = async () => {
    setSyncState('syncing');
    setSyncResponse(null);

    try {
      const res = await fetch('/api/strava_sync', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as SyncResponse;

      if (!res.ok) {
        const errorMessage =
          res.status === 401
            ? 'Your session was not ready to sync. Refresh and try again.'
            : data?.error || 'Strava sync failed. Try again.';

        setSyncState('error');
        setSyncResponse({ ...data, error: errorMessage });
        return;
      }

      const imported = Number(data?.inserted ?? 0);
      track('strava_sync_completed', { activities_imported: imported });

      setSyncState('success');
      setSyncResponse(data);
      onSyncComplete?.();

      window.setTimeout(() => {
        setSyncState((current) => (current === 'success' ? 'idle' : current));
      }, 5000);
    } catch (err) {
      console.error('[StravaConnectBanner] unexpected sync error:', err);
      setSyncState('error');
      setSyncResponse({ error: 'Unexpected sync error. Try again.' });
    }
  };

  if (stravaConnected) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
              <img src="/strava-2.svg" alt="Strava" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-950">Strava connected</p>
              <p className="text-xs text-zinc-500">
                {syncMessage || 'Sync recent activities to keep coaching current.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncState === 'syncing' ? 'Syncing…' : 'Sync latest'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
            <img src="/strava-2.svg" alt="Strava" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-950">Connect Strava</p>
            <p className="text-xs text-zinc-500">Automatically match completed workouts to your plan.</p>
          </div>
        </div>

        <a
          href={connectUrl}
          onClick={() => track('strava_connect_clicked')}
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Connect
        </a>
      </div>
    </div>
  );
}
