'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type LocalRace = {
  id: string;
  name: string;
  type: string;
  date: string;
  location: string;
  signupUrl: string;
};

const LOCAL_RACES: LocalRace[] = [
  {
    id: 'seattle-rock-n-roll-half',
    name: 'Rock n Roll Seattle Half Marathon',
    type: 'Half Marathon',
    date: '2026-06-21',
    location: 'Seattle, WA',
    signupUrl: 'https://www.runrocknroll.com/seattle-register',
  },
  {
    id: 'chicago-triathlon-olympic',
    name: 'Chicago Triathlon',
    type: 'Olympic',
    date: '2026-08-23',
    location: 'Chicago, IL',
    signupUrl: 'https://www.chicagotriathlon.com/register/',
  },
  {
    id: 'austin-marathon',
    name: 'Austin Marathon',
    type: 'Marathon',
    date: '2026-02-15',
    location: 'Austin, TX',
    signupUrl: 'https://youraustinmarathon.com/register/',
  },
  {
    id: 'la-triathlon-sprint',
    name: 'LA Triathlon',
    type: 'Sprint',
    date: '2026-09-20',
    location: 'Los Angeles, CA',
    signupUrl: 'https://www.latriathlon.com/register',
  },
  {
    id: 'nyc-marathon',
    name: 'New York City Marathon',
    type: 'Marathon',
    date: '2026-11-01',
    location: 'New York, NY',
    signupUrl: 'https://www.nyrr.org/tcsnycmarathon/runners/entry',
  },
];

export default function RaceFinderPage() {
  const router = useRouter();
  const [raceSearch, setRaceSearch] = useState('');

  const filteredLocalRaces = useMemo(() => {
    const query = raceSearch.trim().toLowerCase();
    if (!query) return LOCAL_RACES;
    return LOCAL_RACES.filter((race) => race.location.toLowerCase().includes(query));
  }, [raceSearch]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Race finder</h1>
            <p className="mt-1 text-sm text-gray-600">
              Choose a race and we’ll prefill your plan setup with the event type and date.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/plan')}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to plan setup
          </button>
        </div>

        <input
          type="text"
          value={raceSearch}
          onChange={(e) => setRaceSearch(e.target.value)}
          placeholder="Search by city or state (e.g. Austin, TX)"
          className="mt-5 w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100"
        />

        <div className="mt-4 space-y-3">
          {filteredLocalRaces.map((race) => (
            <div key={race.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{race.name}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {race.location} • {race.date} • {race.type}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/plan?raceType=${encodeURIComponent(race.type)}&raceDate=${encodeURIComponent(race.date)}`
                      )
                    }
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Use this race
                  </button>
                  <a
                    href={race.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Sign up
                  </a>
                </div>
              </div>
            </div>
          ))}
          {!filteredLocalRaces.length ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              No races found for that location yet. Try a nearby city or keep entering your race manually.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
