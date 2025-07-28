'use client';

import { useState } from 'react';

type Props = {
  stravaConnected: boolean;
};

export default function StravaConnectBanner({ stravaConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const connectUrl =
    'https://www.strava.com/oauth/authorize?client_id=145662&response_type=code&redirect_uri=https://www.traingpt.co/api/strava/callback&scope=activity:read_all,profile:read_all&approval_prompt=auto';

  const handleSync = async () => {
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch('/api/strava_sync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        console.error('Sync failed:', data?.error);
        alert('Strava sync failed.');
      } else {
        console.log(`✅ Synced ${data.inserted} activities`);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000); // hide after 3s
      }
    } catch (err) {
      console.error('Error syncing Strava:', err);
      alert('Unexpected sync error.');
    } finally {
      setLoading(false);
    }
  };

  if (stravaConnected) {
    return (
      <div className="mt-6 mb-6 flex flex-col items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-0">
        <div className="flex items-center gap-2">
          <img src="/strava-2.svg" alt="Strava" className="w-5 h-5" />
          <span className="text-sm text-gray-700">Strava Connected</span>
          {success && (
            <span className="ml-2 text-sm text-green-600">✅ Up to date</span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className="inline-flex items-center rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          {loading && (
            <svg
              className="mr-2 h-4 w-4 animate-spin text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
              ></path>
            </svg>
          )}
          {loading ? 'Syncing…' : 'Sync Latest'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-6 rounded-xl border border-orange-500 bg-orange-50 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center">
          <img src="/strava-2.svg" alt="Strava" className="w-6 h-6 mr-3" />
          <p className="text-sm text-orange-800">
            Connect with Strava to automatically track your completed workouts.
          </p>
        </div>
        <a
          href={connectUrl}
          className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Connect
        </a>
      </div>
    </div>
  );
}
