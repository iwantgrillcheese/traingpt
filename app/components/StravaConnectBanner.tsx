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
  if (state === 'syncing') return 'Importing latest Strava activities…';
  if (state === 'error') return response?.error || 'Strava sync failed. Try again.';
  if (state !== 'success') return null;

  const inserted = Number(response?.inserted ?? 0);
  const totalFetched = Number(response?.totalFetched ?? 0);

  if (inserted > 0) {
    return `Imported ${inserted} new ${inserted === 1 ? 'activity' : 'activities'}.`;
  }

  if (totalFetched > 0) {
    return 'Strava is already up to date.';
  }

  return 'No new activities found.';
}

export default function StravaConnectBanner({ stravaConnected, onSyncComplete }: Props) {
  const [connectUrl, setConnectUrl] = useState('#');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncResponse, setSyncResponse] = useState<SyncResponse | null>(null);

  useEffect(() => {
    setConnectUrl(buildStravaConnectUrl());
  }, []);

  const syncMessage = useMemo(
    () => getSyncMessage(syncState, syncResponse),
    [syncResponse, syncState]
  );

  const handleSync = async () => {
    setSyncState('syncing');
    setSyncResponse(null);

    try {
      const res = await fetch('/api/strava_sync', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as SyncResponse;

      if (!res.ok) {
        console.error('[StravaConnectBanner] sync failed:', data?.error);
        setSyncState('error');
        setSyncResponse(data);
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
      setSyncResponse({ error: 'Unexpected sync error.' });
    }
  };

  if (stravaConnected) {
    return (
      <div className="mb-6 mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <img src="/strava-2.svg" alt="Strava" className="mt-0.5 h-5 w-5" />
            <div>
              <p className="text-sm font-medium text-zinc-900">Strava connected</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Sync latest activities to update your training history and coaching insights.
              </p>
              {syncMessage ? (
                <p
                  className={`mt-2 text-xs font-medium ${
                    syncState === 'error' ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {syncMessage}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncState === 'syncing' ? 'Syncing…' : 'Sync latest'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 mt-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <img src="/strava-2.svg" alt="Strava" className="mt-0.5 h-6 w-6" />
          <div>
            <p className="text-sm font-medium text-orange-950">Connect Strava</p>
            <p className="mt-1 text-sm leading-5 text-orange-800">
              Automatically match completed workouts to your training plan.
            </p>
          </div>
        </div>

        <a
          href={connectUrl}
          onClick={() => track('strava_connect_clicked')}
          className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Connect Strava
        </a>
      </div>
    </div>
  );
}
