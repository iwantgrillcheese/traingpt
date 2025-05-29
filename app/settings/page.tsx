// Updated ProfilePage with editable training metrics

'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProfilePage() {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<any>(null);
  const [optIn, setOptIn] = useState<boolean>(true);

  useEffect(() => {
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

      const { data: userData } = await supabase
        .from('users')
        .select('marketing_opt_in')
        .eq('id', session.user.id)
        .single();

      if (userData?.marketing_opt_in !== undefined) setOptIn(userData.marketing_opt_in);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setProfile({ ...baseProfile, ...profileData });
    };

    loadProfile();
  }, []);

  const toggleOptIn = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const newOpt = !optIn;
    setOptIn(newOpt);
    await supabase.from('users').update({ marketing_opt_in: newOpt }).eq('id', session.user.id);
  };

  const handleProfileUpdate = async (field: string, value: any) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    setProfile((prev: any) => ({ ...prev, [field]: value }));
    await supabase.from('profiles').update({ [field]: value }).eq('id', session.user.id);
  };

  const handleDisconnectStrava = async () => {
    await fetch('/api/strava_disconnect', { method: 'POST' });
    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm('Are you sure you want to delete your account? This cannot be undone.');
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

  if (!profile) return <div className="text-center py-20 text-gray-500">Loading profile...</div>;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-8">Account Settings</h1>

      <div className="space-y-8">
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Training Zones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Swim Threshold (sec / 100m)</label>
              <input
                type="number"
                value={profile.swim_threshold_per_100m || ''}
                onChange={(e) => handleProfileUpdate('swim_threshold_per_100m', parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
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
              <label className="block text-sm text-gray-500 mb-1">Run Threshold (sec / mile)</label>
              <input
                type="number"
                value={profile.run_threshold_per_mile || ''}
                onChange={(e) => handleProfileUpdate('run_threshold_per_mile', parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </section>

        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Email Preferences</h2>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={optIn} onChange={toggleOptIn} className="w-4 h-4" />
            I’d like to receive occasional product updates and tips
          </label>
        </section>

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
            ) : (
              <a
                href={`https://www.strava.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_BASE_URL}/api/strava/callback&scope=activity:read_all,profile:read_all`}
                className="text-blue-500 text-sm underline"
              >
                Connect
              </a>
            )}
          </div>
        </section>

        <section className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium text-red-700 mb-4">Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">
            Deleting your account will erase all your plans, history, and preferences. This action cannot be undone.
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
