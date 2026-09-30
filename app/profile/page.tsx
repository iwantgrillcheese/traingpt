'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BrickProfileCard from '@/app/components/BrickProfileCard';
import type { BrickProfile } from '@/lib/strava/athlete-profile';
import Link from 'next/link';

export default function ProfilePage() {
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string } | null>(null);

  const [athlete, setAthlete] = useState<BrickProfile | null>(null);
  const [athleteError, setAthleteError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/strava/reveal', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Connect Strava and complete your history import to discover your Brick profile.');
      return response.json();
    }).then(data => setAthlete(data.brickProfile)).catch(error => { if (!controller.signal.aborted) setAthleteError(error.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        console.error('Error fetching session:', error);
        return;
      }

      const { user_metadata, email } = session.user;
      setProfile({
        name: user_metadata?.full_name || 'Anonymous',
        email: email || '',
        avatar: user_metadata?.avatar_url || '',
      });
    };

    loadProfile();
  }, []);

  if (!profile) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-zinc-500">Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mx-auto mb-6 max-w-2xl rounded-[2rem] bg-[#101114] p-7 sm:p-10">{athlete ? <BrickProfileCard profile={athlete} shareable /> : <div className="text-sm text-white/65"><p>{athleteError || 'Reading your athlete profile…'}</p>{athleteError ? <Link href="/strava-reveal" className="mt-4 inline-block text-white underline">Discover my profile</Link> : null}</div>}</div>
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow border border-zinc-100">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        <div className="flex items-center gap-4 mb-6">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border border-zinc-300"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-200" />
          )}
          <div>
            <p className="font-medium text-lg">{profile.name}</p>
            <p className="text-zinc-500 text-sm">{profile.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-500 block mb-1">Name</label>
            <input
              value={profile.name}
              disabled
              className="w-full border rounded-lg px-3 py-2 bg-zinc-100 text-zinc-700"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-500 block mb-1">Email</label>
            <input
              value={profile.email}
              disabled
              className="w-full border rounded-lg px-3 py-2 bg-zinc-100 text-zinc-700"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

