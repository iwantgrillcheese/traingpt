'use client';

type Props = {
  stravaConnected: boolean;
};

export default function StravaConnectBanner({ stravaConnected }: Props) {
  const connectUrl =
    'https://www.strava.com/oauth/authorize?client_id=145662&response_type=code&redirect_uri=https://www.traingpt.co/api/strava/callback&scope=activity:read_all,profile:read_all&approval_prompt=auto';

  if (stravaConnected) {
    return (
      <div className="mt-6 mb-6 flex flex-col items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-0">
        <div className="flex items-center gap-2">
          <img src="/strava-2.svg" alt="Strava" className="w-5 h-5" />
          <span className="text-sm text-gray-700">Strava Connected</span>
        </div>
        <button
          onClick={() => fetch('/api/strava_sync', { method: 'POST' })}
          className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          Sync Latest
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
