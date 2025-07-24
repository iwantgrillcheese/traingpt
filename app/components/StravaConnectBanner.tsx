'use client';

type Props = {
  stravaConnected: boolean;
};

export default function StravaConnectBanner({ stravaConnected }: Props) {
  if (stravaConnected) {
    return (
      <div className="mt-6 mb-6 inline-flex items-center space-x-3 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
        <img src="/strava-icon.svg" alt="Strava" className="w-5 h-5" />
        <span className="text-sm text-gray-700">Strava Connected</span>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-6 rounded-xl border border-orange-500 bg-orange-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <img src="/strava-icon.svg" alt="Strava" className="w-6 h-6 mr-3" />
          <p className="text-sm text-orange-800">
            Connect with Strava to automatically track your completed workouts.
          </p>
        </div>
        <a
          href="/api/strava/connect"
          className="ml-4 rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Connect
        </a>
      </div>
    </div>
  );
}
