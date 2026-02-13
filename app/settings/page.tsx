'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import {
  DEFAULT_FUELING_PREFERENCES,
  loadFuelingPreferences,
  saveFuelingPreferences,
} from '@/lib/fueling-preferences';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [optIn, setOptIn] = useState<boolean>(true);
  const [fuelingPreferences, setFuelingPreferences] = useState(DEFAULT_FUELING_PREFERENCES);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const canShowResetDataButton =
    (profile?.email || '').toLowerCase() === 'me@cameronmcdiarmid.com';

  const secondsToTimeString = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const timeStringToSeconds = (input: string) => {
    const [min, sec] = input.split(':').map(Number);
    return min * 60 + (sec || 0);
  };

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) return;

      const { user_metadata, email } = session.user;
      const baseProfile = {
        name: user_metadata?.full_name || 'Anonymous',
        email: email || '',
        avatar: user_metadata?.avatar_url || '',
      };

      // ✅ Typed query + safe boolean coercion
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('marketing_opt_in')
        .eq('id', session.user.id)
        .single()
        .returns<{ marketing_opt_in: boolean | null }>();

      if (userErr) {
        console.error('Error loading user marketing_opt_in:', userErr);
      }

      if (!cancelled) {
        setOptIn(userData?.marketing_opt_in === true);
      }

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileErr) {
        console.error('Error loading profile:', profileErr);
      }

      if (!cancelled) {
        setProfile({ ...baseProfile, ...(profileData ?? {}) });
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFuelingPreferences(loadFuelingPreferences());
  }, []);

  const handleFuelingPreferenceUpdate = (
    field: 'enabled' | 'bodyWeightKg' | 'bodyFatPct' | 'sweatRateLPerHour',
    value: boolean | string
  ) => {
    setFuelingPreferences((prev) => {
      const next = { ...prev, [field]: value } as typeof prev;
      saveFuelingPreferences(next);
      return next;
    });
  };

  const toggleOptIn = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const newOpt = !optIn;
    setOptIn(newOpt);

    const { error } = await supabase
      .from('users')
      .update({ marketing_opt_in: newOpt })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error updating marketing_opt_in:', error);
      // Optional: revert optimistic UI on failure
      setOptIn(!newOpt);
    }
  };

  const handleProfileUpdate = async (field: string, value: any) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    setProfile((prev: any) => ({ ...prev, [field]: value }));

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error updating profile field:', field, error);
    }
  };

  const handleDisconnectStrava = async () => {
    await fetch('/api/strava_disconnect', { method: 'POST' });
    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This cannot be undone.'
    );
    if (!confirmed) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('plans').delete().eq('user_id', session.user.id);
    await supabase.from('completed_sessions').delete().eq('user_id', session.user.id);
    await supabase.from('users').delete().eq('id', session.user.id);

    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleManageSubscription = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });

    if (!res.ok) {
      console.error('Failed to load Stripe portal');
      return;
    }

    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  const handleResetMyData = async () => {
    const typed = window.prompt('Type RESET to wipe your training data.');
    if (typed !== 'RESET') return;

    try {
      setResetLoading(true);
      setResetMessage(null);

      const res = await fetch('/api/dev/reset-my-data', { method: 'POST' });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResetMessage(json?.error || 'Reset failed');
        return;
      }

      const deleted = json?.deleted || {};
      setResetMessage(
        `Reset complete. plans=${deleted.plans ?? 0}, sessions=${deleted.sessions ?? 0}, completed=${deleted.completed_sessions ?? 0}, strava=${deleted.strava_activities ?? 0}`
      );

      window.location.href = '/plan';
    } catch (err: any) {
      setResetMessage(err?.message || 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  if (!profile) return <div className="text-center py-20 text-gray-500">Loading profile...</div>;

  const stravaClientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-8">Account Settings</h1>

      <div className="space-y-8">
        {/* Training Zones */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Training Zones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Swim Threshold (mm:ss / 100m)
              </label>
              <input
                type="text"
                value={secondsToTimeString(profile.swim_threshold_per_100m || 0)}
                onChange={(e) =>
                  handleProfileUpdate(
                    'swim_threshold_per_100m',
                    timeStringToSeconds(e.target.value)
                  )
                }
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 1:45"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">Bike FTP (watts)</label>
              <input
                type="number"
                value={profile.bike_ftp || ''}
                onChange={(e) => handleProfileUpdate('bike_ftp', parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Run Threshold (mm:ss / {profile.run_pace_unit === 'km' ? 'km' : 'mile'})
              </label>
              <input
                type="text"
                value={secondsToTimeString(profile.run_threshold_per_mile || 0)}
                onChange={(e) =>
                  handleProfileUpdate(
                    'run_threshold_per_mile',
                    timeStringToSeconds(e.target.value)
                  )
                }
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 7:30"
              />
              <div className="mt-2">
                <label className="text-xs text-gray-500 mr-2">Units:</label>
                <select
                  value={profile.run_pace_unit || 'mile'}
                  onChange={(e) => handleProfileUpdate('run_pace_unit', e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="mile">mile</option>
                  <option value="km">km</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Email Opt-In */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Email Preferences</h2>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={optIn} onChange={toggleOptIn} className="w-4 h-4" />
            I’d like to receive occasional product updates and tips
          </label>
        </section>

        {/* Strava */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Connected Apps</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Strava</p>
              <p className="text-sm text-gray-500">
                {profile?.strava_access_token ? 'Connected' : 'Not connected'}
              </p>
            </div>

            {profile?.strava_access_token ? (
              <button onClick={handleDisconnectStrava} className="text-red-500 text-sm underline">
                Disconnect
              </button>
            ) : !stravaClientId || !baseUrl ? (
              <p className="text-sm text-red-500">Strava config missing</p>
            ) : (
              <a
                href={`https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&response_type=code&redirect_uri=${baseUrl}/api/strava/callback&scope=activity:read_all,profile:read_all`}
                className="text-blue-500 text-sm underline"
              >
                Connect
              </a>
            )}
          </div>
        </section>

        {/* Subscription */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Subscription</h2>
          <p className="text-sm text-gray-600 mb-4">
            View your current plan, update payment info, or cancel anytime via Stripe.
          </p>
          <button
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition"
            onClick={handleManageSubscription}
          >
            Manage Subscription
          </button>
        </section>

        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-2">Fueling</h2>
          <p className="text-sm text-gray-600">
            Set defaults for workout fueling guidance. You can still adjust these per-session from
            your calendar.
          </p>

          <div className="mt-4 rounded-xl border border-black/10 bg-zinc-50/70 p-4">
            <label className="flex items-center gap-3 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={fuelingPreferences.enabled}
                onChange={(e) => handleFuelingPreferenceUpdate('enabled', e.target.checked)}
                className="h-4 w-4"
              />
              Enable fueling guidance by default
            </label>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">Body weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fuelingPreferences.bodyWeightKg}
                  onChange={(e) => handleFuelingPreferenceUpdate('bodyWeightKg', e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="70"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-600">Body fat % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="0.1"
                  value={fuelingPreferences.bodyFatPct}
                  onChange={(e) => handleFuelingPreferenceUpdate('bodyFatPct', e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="18"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-600">Sweat rate L/hr (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fuelingPreferences.sweatRateLPerHour}
                  onChange={(e) =>
                    handleFuelingPreferenceUpdate('sweatRateLPerHour', e.target.value)
                  }
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="0.8"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/fueling"
              className="inline-flex rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition"
            >
              Open fueling shop guide
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Want workout-specific nutrition guidance? Turn on fueling when generating a detailed
            session from your calendar.
          </p>
          <Link
            href="/fueling"
            className="inline-flex rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition"
          >
            Open fueling shop guide
          </Link>
        </section>

        {canShowResetDataButton && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-medium text-amber-800 mb-2">Dev Tools</h2>
            <p className="text-sm text-amber-700 mb-4">
              Reset your training data (plans, sessions, completed sessions, Strava activities) for
              fresh testing. You will be asked to type RESET.
            </p>
            <button
              onClick={handleResetMyData}
              disabled={resetLoading}
              className="px-5 py-2 text-sm rounded-full bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-60"
            >
              {resetLoading ? 'Resetting…' : 'Reset my training data'}
            </button>
            {resetMessage && <p className="mt-3 text-sm text-amber-800">{resetMessage}</p>}
          </section>
        )}

        {/* Danger Zone */}
        <section className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium text-red-700 mb-4">Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">
            Deleting your account will erase all your plans, history, and preferences. This action
            cannot be undone.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="px-5 py-2 text-sm rounded-full bg-red-600 text-white hover:bg-red-700 transition"
          >
            Delete My Account
          </button>
        </section>
      </div>
    </main>
  );
}
