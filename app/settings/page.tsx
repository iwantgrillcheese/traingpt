'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProfilePage() {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [optIn, setOptIn] = useState<boolean>(true);

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

      const { data: userData } = await supabase.from('users').select('marketing_opt_in').eq('id', session.user.id).single();
      if (userData?.marketing_opt_in !== undefined) setOptIn(userData.marketing_opt_in);
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
          <h2 className="text-lg font-medium mb-4">Personal Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Name</label>
              <input value={profile.name} disabled className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Email</label>
              <input value={profile.email} disabled className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
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

        <section className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium text-red-700 mb-4">Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">Deleting your account will erase all your plans, history, and preferences. This action cannot be undone.</p>
          <button onClick={handleDeleteAccount} className="px-5 py-2 text-sm rounded-full bg-red-600 text-white hover:bg-red-700 transition">
            Delete My Account
          </button>
        </section>
      </div>
    </main>
  );
}
